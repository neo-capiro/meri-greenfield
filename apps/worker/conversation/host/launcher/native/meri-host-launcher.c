#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <grp.h>
#include <linux/capability.h>
#include <linux/magic.h>
#include <poll.h>
#include <sched.h>
#include <signal.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mount.h>
#include <sys/prctl.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/statfs.h>
#include <sys/syscall.h>
#include <sys/types.h>
#include <sys/un.h>
#include <sys/wait.h>
#include <unistd.h>

/* Root-owned, non-setuid host helper. It is invoked only by the trusted host supervisor. No tool UID can run it
 * successfully: root EUID/RUID are required, and the image must install it outside tool-readable mounts. A C
 * binary is necessary because Node has no supported pre-exec setns/cgroup/credential hook or SO_PEERCRED server.
 * All names and commands are supplied by the trusted supervisor, never by a shim request. Failure is terminal. */

#ifndef NSFS_MAGIC
#define NSFS_MAGIC 0x6e736673
#endif
#ifndef PR_CAP_AMBIENT_CLEAR_ALL
#define PR_CAP_AMBIENT_CLEAR_ALL 4
#endif

#define FAIL 111
#define MAX_ARGS 128
static void die(void) { _exit(FAIL); }
static int write_all(int fd, const void *data, size_t len) {
  const char *p=data;
  while(len) { ssize_t n=write(fd,p,len); if(n<0&&errno==EINTR) continue; if(n<=0) return -1; p+=n; len-=(size_t)n; }
  return 0;
}
static int read_exact(int fd, void *data, size_t len) {
  char *p=data;
  while(len) { ssize_t n=read(fd,p,len); if(n<0&&errno==EINTR) continue; if(n<=0) return -1; p+=n; len-=(size_t)n; }
  return 0;
}
static int valid_hex(const char *s, size_t n) {
  if(!s||strlen(s)!=n) return 0;
  for(size_t i=0;i<n;i++) if(!((s[i]>='0'&&s[i]<='9')||(s[i]>='a'&&s[i]<='f'))) return 0;
  return 1;
}
static int valid_uuid(const char *s) {
  if(!s||strlen(s)!=36) return 0;
  for(size_t i=0;i<36;i++) if(i==8||i==13||i==18||i==23) {if(s[i]!='-') return 0;}
    else if(!((s[i]>='0'&&s[i]<='9')||(s[i]>='a'&&s[i]<='f'))) return 0;
  return 1;
}
static int valid_name(const char *s) {
  size_t n=s?strlen(s):0; if(n<1||n>63) return 0;
  for(size_t i=0;i<n;i++) if(!((s[i]>='a'&&s[i]<='z')||(s[i]>='0'&&s[i]<='9')||s[i]=='-')) return 0;
  return 1;
}
static int absolute_path(const char *s) {
  if(!s||s[0]!='/'||strlen(s)>4095||strchr(s,'\n')) return 0;
  for(const char *p=s+1;*p;) {
    const char *end=strchr(p,'/');size_t n=end?(size_t)(end-p):strlen(p);
    if(!n||(n==1&&p[0]=='.')||(n==2&&p[0]=='.'&&p[1]=='.')) return 0;
    if(!end) break;
    p=end+1;
    if(!*p) return 0;
  }
  return 1;
}
static unsigned long long number(const char *s, unsigned long long max) {
  if(!s||!*s) die();
  unsigned long long n=0;
  for(const char *p=s;*p;p++) { if(*p<'0'||*p>'9'||n>(max-(unsigned)(*p-'0'))/10) die(); n=n*10+(unsigned)(*p-'0'); }
  return n;
}
static void require_root(void) { if(getuid()!=0||geteuid()!=0||getgid()!=0||getegid()!=0) die(); }
static void safe_dir(int fd) {
  struct stat st; if(fstat(fd,&st)||!S_ISDIR(st.st_mode)||st.st_uid!=0||(st.st_mode&0022)) die();
}
static int child_dir(int parent, const char *name) {
  if(mkdirat(parent,name,0755)&&errno!=EEXIST) die();
  int fd=openat(parent,name,O_PATH|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
  if(fd<0) die();
  safe_dir(fd);
  return fd;
}
typedef struct {
  const char *host_id,*generation,*binding_sha,*kind,*ns_name,*ns_dev,*ns_ino,*uid,*gid,*cwd,*home,*browsers,*exe;
  char **argv;
} spec;
extern char **environ;
static char **sdk_environment(void) {
  static const char *allowed[]={"PATH","HOME","CLAUDE_CONFIG_DIR","CLAUDE_SECURESTORAGE_CONFIG_DIR",
    "ANTHROPIC_BASE_URL","ANTHROPIC_AUTH_TOKEN","CLAUDE_CODE_SUBPROCESS_ENV_SCRUB","NODE_EXTRA_CA_CERTS",
    "CLAUDE_CODE_MAX_OUTPUT_TOKENS","MAX_THINKING_TOKENS","CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
    "LANG","LC_ALL","TMPDIR",NULL};
  char **clean=calloc(16,sizeof(char *));if(!clean) die();size_t used=0;
  for(char **item=environ;item&&*item;item++) {
    char *equal=strchr(*item,'=');if(!equal) die();size_t key=(size_t)(equal-*item);int accepted=0;
    for(size_t i=0;allowed[i];i++) if(strlen(allowed[i])==key&&!memcmp(allowed[i],*item,key)) accepted=1;
    if(!accepted||used>=14) die();
    for(size_t i=0;i<used;i++) if(!strncmp(clean[i],*item,key)&&clean[i][key]=='=') die();
    clean[used]=strdup(*item);if(!clean[used]) die();used++;
  }
  if(clearenv()) die();
  return clean;
}
static spec parse_spec(int argc,char **argv,int start) {
  if(argc-start<13||argc-start>MAX_ARGS) die();
  spec s={argv[start],argv[start+1],argv[start+2],argv[start+3],argv[start+4],argv[start+5],argv[start+6],argv[start+7],argv[start+8],argv[start+9],argv[start+10],argv[start+11],argv[start+12],&argv[start+12]};
  if(!valid_uuid(s.host_id)||!valid_hex(s.binding_sha,64)||
     (strcmp(s.kind,"sdk")&&strcmp(s.kind,"browser")&&strcmp(s.kind,"relay-sdk")&&strcmp(s.kind,"relay-browser"))||!valid_name(s.ns_name)||
     number(s.generation,999999999)<1||number(s.uid,65533)<1000||number(s.gid,65533)<1000||
     !absolute_path(s.cwd)||!absolute_path(s.home)||!absolute_path(s.browsers)||!absolute_path(s.exe)) die();
  (void)number(s.ns_dev,UINT64_MAX);(void)number(s.ns_ino,UINT64_MAX);
  for(char **p=s.argv;*p;p++) if(strlen(*p)>8192) die();
  return s;
}
static int cgroup_fd(spec *s) {
  int root=open("/sys/fs/cgroup/meri/hosts",O_PATH|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
  struct statfs fs;
  if(root<0||fstatfs(root,&fs)||fs.f_type!=CGROUP2_SUPER_MAGIC) die();
  safe_dir(root);
  char host[64];int n=snprintf(host,sizeof(host),"%s-%s",s->host_id,s->generation);
  if(n<0||(size_t)n>=sizeof(host)) die();
  int generation=child_dir(root,host),run=child_dir(generation,s->binding_sha),leaf=child_dir(run,s->kind);
  close(root);close(generation);close(run);return leaf;
}
static void attach_cgroup(spec *s) {
  int leaf=cgroup_fd(s);
  int procs=openat(leaf,"cgroup.procs",O_WRONLY|O_NOFOLLOW|O_CLOEXEC);
  if(procs<0) die();
  char pid[32];int n=snprintf(pid,sizeof(pid),"%ld",(long)getpid());
  if(n<1||(size_t)n>=sizeof(pid)||write_all(procs,pid,(size_t)n)) die();
  close(procs);close(leaf);
  char expected[256];n=snprintf(expected,sizeof(expected),"0::/meri/hosts/%s-%s/%s/%s\n",s->host_id,s->generation,s->binding_sha,s->kind);
  if(n<1||(size_t)n>=sizeof(expected)) die();
  int proc=open("/proc/self/cgroup",O_RDONLY|O_NOFOLLOW|O_CLOEXEC);char observed[256]={0};
  if(proc<0) die();
  ssize_t count=read(proc,observed,sizeof(observed)-1);close(proc);
  if(count!=n||memcmp(expected,observed,(size_t)n)) die();
}
static void enter_namespace(spec *s) {
  int base=open("/run/netns",O_PATH|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);if(base<0) die();safe_dir(base);
  int ns=openat(base,s->ns_name,O_RDONLY|O_NOFOLLOW|O_CLOEXEC);close(base);
  struct stat st;struct statfs fs;
  if(ns<0||fstat(ns,&st)||fstatfs(ns,&fs)||fs.f_type!=NSFS_MAGIC||
     (unsigned long long)st.st_dev!=number(s->ns_dev,UINT64_MAX)||
     (unsigned long long)st.st_ino!=number(s->ns_ino,UINT64_MAX)||setns(ns,CLONE_NEWNET)) die();
  close(ns);
}
static void hide_cgroupfs(void) {
  if(unshare(CLONE_NEWNS)||mount(NULL,"/",NULL,MS_PRIVATE|MS_REC,NULL)||
     umount2("/sys/fs/cgroup",MNT_DETACH)||
     mount("tmpfs","/sys/fs/cgroup","tmpfs",MS_NOSUID|MS_NODEV|MS_NOEXEC,"size=4096,mode=000")||
     mount(NULL,"/sys/fs/cgroup",NULL,MS_REMOUNT|MS_RDONLY|MS_NOSUID|MS_NODEV|MS_NOEXEC,NULL)) die();
}
static void drop_privilege(spec *s) {
  unsigned long uid=number(s->uid,65533),gid=number(s->gid,65533);
  int dir=open(s->cwd,O_PATH|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);if(dir<0||fchdir(dir)) die();close(dir);
  if(setgroups(0,NULL)) die();
  for(int cap=0;cap<=CAP_LAST_CAP;cap++) if(prctl(PR_CAPBSET_DROP,cap,0,0,0)&&errno!=EINVAL) die();
  if(prctl(PR_CAP_AMBIENT,PR_CAP_AMBIENT_CLEAR_ALL,0,0,0)||setresgid((gid_t)gid,(gid_t)gid,(gid_t)gid)||
     setresuid((uid_t)uid,(uid_t)uid,(uid_t)uid)||prctl(PR_SET_NO_NEW_PRIVS,1,0,0,0)) die();
  struct __user_cap_header_struct h={_LINUX_CAPABILITY_VERSION_3,0};
  struct __user_cap_data_struct d[2]={{0}};
  if(syscall(SYS_capset,&h,d)||getuid()!=uid||geteuid()!=uid||getgid()!=gid||getegid()!=gid) die();
}
static void confined_exec(spec *s,int ready,int gate) {
  pid_t parent=getppid();
  attach_cgroup(s);enter_namespace(s);hide_cgroupfs();drop_privilege(s);
  /* Linux clears PDEATHSIG when effective credentials change. Arm only after the final UID/GID drop. */
  if(prctl(PR_SET_PDEATHSIG,SIGKILL)||getppid()!=parent) die();
  if(write_all(ready,"R\n",2)) die();
  char go;
  if(read_exact(gate,&go,1)||go!='G') die();
  if(close_range(3,~0U,0)) die();
  if(!strcmp(s->kind,"sdk")) {
    char **environment=sdk_environment();
    execve(s->exe,s->argv,environment);
  } else {
    char home[4096],browsers[4096];
    if(snprintf(home,sizeof(home),"HOME=%s",s->home)>=(int)sizeof(home)||
       snprintf(browsers,sizeof(browsers),"PLAYWRIGHT_BROWSERS_PATH=%s",s->browsers)>=(int)sizeof(browsers)) die();
    char *environment[]={home,browsers,"PATH=/usr/bin:/bin","LANG=C.UTF-8",NULL};
    if(clearenv()) die();
    execve(s->exe,s->argv,environment);
  }
  die();
}
static void direct_run(spec *s) { confined_exec(s,3,4); }
static int unix_listener(const char *path,gid_t gid) {
  if(!path||strlen(path)>=sizeof(((struct sockaddr_un *)0)->sun_path)||strncmp(path,"/run/meri-launch/",17)) die();
  char dir[108];strcpy(dir,path);char *slash=strrchr(dir,'/');if(!slash||slash==dir) die();*slash='\0';
  int d=open(dir,O_PATH|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);struct stat st;
  if(d<0||fstat(d,&st)||!S_ISDIR(st.st_mode)||st.st_uid!=0||st.st_gid!=gid||(st.st_mode&0007)||(st.st_mode&0020)) die();
  close(d);
  int fd=socket(AF_UNIX,SOCK_STREAM|SOCK_CLOEXEC,0);if(fd<0) die();
  struct sockaddr_un a={.sun_family=AF_UNIX};strcpy(a.sun_path,path);
  if(bind(fd,(struct sockaddr *)&a,sizeof(a))||chown(path,0,gid)||chmod(path,0660)||listen(fd,1)) die();
  return fd;
}
static void receive_stdio(int conn,const char *nonce,int out[3]) {
  struct ucred peer;socklen_t size=sizeof(peer);
  if(getsockopt(conn,SOL_SOCKET,SO_PEERCRED,&peer,&size)||size!=sizeof(peer)) die();
  (void)peer;
  char token[64],control[CMSG_SPACE(sizeof(int)*3)];
  struct iovec iov={.iov_base=token,.iov_len=sizeof(token)};
  struct msghdr msg={.msg_iov=&iov,.msg_iovlen=1,.msg_control=control,.msg_controllen=sizeof(control)};
  ssize_t n=recvmsg(conn,&msg,MSG_WAITALL);
  if(n!=64||msg.msg_flags&(MSG_CTRUNC|MSG_TRUNC)||memcmp(token,nonce,64)) die();
  struct cmsghdr *c=CMSG_FIRSTHDR(&msg);
  if(!c||c->cmsg_level!=SOL_SOCKET||c->cmsg_type!=SCM_RIGHTS||c->cmsg_len!=CMSG_LEN(sizeof(int)*3)||CMSG_NXTHDR(&msg,c)) die();
  memcpy(out,CMSG_DATA(c),sizeof(int)*3);
  for(int i=0;i<3;i++) {
    struct stat st;if(out[i]<0||fstat(out[i],&st)) die();
    if(S_ISFIFO(st.st_mode)) continue;
    if(!S_ISSOCK(st.st_mode)) die();
    struct sockaddr_un local,remote;socklen_t local_length=sizeof(local),remote_length=sizeof(remote);
    int type;socklen_t type_length=sizeof(type);
    if(getsockname(out[i],(struct sockaddr *)&local,&local_length)||getpeername(out[i],(struct sockaddr *)&remote,&remote_length)||
       local.sun_family!=AF_UNIX||remote.sun_family!=AF_UNIX||
       local_length!=offsetof(struct sockaddr_un,sun_path)||remote_length!=offsetof(struct sockaddr_un,sun_path)||
       getsockopt(out[i],SOL_SOCKET,SO_TYPE,&type,&type_length)||type_length!=sizeof(type)||type!=SOCK_STREAM) die();
  }
}
static void exact_sdk_cgroup(pid_t pid,spec *s) {
  char path[128],expected[256],observed[256]={0};
  int n=snprintf(path,sizeof(path),"/proc/%ld/cgroup",(long)pid);
  if(n<1||(size_t)n>=sizeof(path)) die();
  int fd=open(path,O_RDONLY|O_NOFOLLOW|O_CLOEXEC);
  if(fd<0) die();
  ssize_t count=read(fd,observed,sizeof(observed)-1);close(fd);
  n=snprintf(expected,sizeof(expected),"0::/meri/hosts/%s-%s/%s/sdk\n",s->host_id,s->generation,s->binding_sha);
  if(n<1||(size_t)n>=sizeof(expected)||count!=n||memcmp(expected,observed,(size_t)n)) die();
}
static pid_t sdk_parent_pid(void) {
  char text[16]={0};size_t used=0;
  for(;;) {char c;if(read_exact(5,&c,1)) die();if(c=='\n') break;
    if(c<'0'||c>'9'||used>=sizeof(text)-1) die();
    text[used++]=c;}
  unsigned long long pid=number(text,2147483647);
  if(pid<2) die();
  return (pid_t)pid;
}
static void sdk_still_alive(int pidfd) {
  struct pollfd descriptor={.fd=pidfd,.events=POLLIN};
  int result=poll(&descriptor,1,0);
  if(result!=0) die();
}
static pid_t proc_parent(pid_t pid) {
  char path[128],status[8192]={0};int n=snprintf(path,sizeof(path),"/proc/%ld/status",(long)pid);
  if(n<1||(size_t)n>=sizeof(path)) die();
  int fd=open(path,O_RDONLY|O_NOFOLLOW|O_CLOEXEC);if(fd<0) die();
  ssize_t count=read(fd,status,sizeof(status)-1);close(fd);if(count<=0||count>=(ssize_t)sizeof(status)-1) die();
  const char *line=strstr(status,"\nPPid:\t");if(!line) die();line+=7;
  char parent[16]={0};size_t used=0;
  while(*line==' '||*line=='\t') line++;
  while(*line>='0'&&*line<='9') {if(used>=sizeof(parent)-1) die();parent[used++]=*line++;}
  if(!used||*line!='\n') die();
  return (pid_t)number(parent,2147483647);
}
static void verify_sdk_peer(struct ucred *peer,spec *s,const char *shim_path,pid_t sdk_pid) {
  char path[128];int n;
  exact_sdk_cgroup(peer->pid,s);
  exact_sdk_cgroup(sdk_pid,s);
  /* A Bash child can share the SDK UID and cgroup. Only a shim directly spawned by the one pinned SDK leader
   * receives the Playwright stdio handoff. The parent PID comes from a supervisor-only pipe, never the shim. */
  if(proc_parent(peer->pid)!=sdk_pid) die();
  if(!shim_path||shim_path[0]!='/'||strstr(shim_path,"/../")) die();
  int pinned=open(shim_path,O_PATH|O_NOFOLLOW|O_CLOEXEC);
  if(pinned<0) die();
  struct stat approved,actual;
  n=snprintf(path,sizeof(path),"/proc/%ld/exe",(long)peer->pid);
  if(n<1||(size_t)n>=sizeof(path)||fstat(pinned,&approved)||stat(path,&actual)||
     !S_ISREG(approved.st_mode)||approved.st_uid!=0||(approved.st_mode&0022)||
     approved.st_dev!=actual.st_dev||approved.st_ino!=actual.st_ino) die();
  close(pinned);
}
static void broker_run(int argc,char **argv) {
  if(argc<20||!valid_hex(argv[5],64)) die();
  uid_t peer_uid=(uid_t)number(argv[3],65533);gid_t peer_gid=(gid_t)number(argv[4],65533);
  if(peer_uid<1000||peer_gid<1000) die();
  spec s=parse_spec(argc,argv,7);if(strcmp(s.kind,"browser")) die();
  pid_t supervisor=getppid();
  if(prctl(PR_SET_PDEATHSIG,SIGKILL)||getppid()!=supervisor) die();
  char socket_path[108];
  if(snprintf(socket_path,sizeof(socket_path),"/run/meri-launch/%s.sock",s.binding_sha)>=(int)sizeof(socket_path)||
     strcmp(argv[2],socket_path)) die();
  int listener=unix_listener(argv[2],peer_gid);
  if(write_all(3,"L\n",2)) die();
  pid_t sdk_pid=sdk_parent_pid();exact_sdk_cgroup(sdk_pid,&s);close(5);
#ifdef SYS_pidfd_open
  int sdk_pidfd=(int)syscall(SYS_pidfd_open,sdk_pid,0);
#else
  int sdk_pidfd=-1;
#endif
  if(sdk_pidfd<0) die();
  sdk_still_alive(sdk_pidfd);
  int conn=accept4(listener,NULL,NULL,SOCK_CLOEXEC);if(conn<0) die();close(listener);unlink(argv[2]);
  struct ucred peer;socklen_t size=sizeof(peer);
  if(getsockopt(conn,SOL_SOCKET,SO_PEERCRED,&peer,&size)||size!=sizeof(peer)||peer.uid!=peer_uid||peer.gid!=peer_gid) die();
  sdk_still_alive(sdk_pidfd);verify_sdk_peer(&peer,&s,argv[6],sdk_pid);
  int stdio[3];receive_stdio(conn,argv[5],stdio);
  int ready[2],gate[2];if(pipe2(ready,O_CLOEXEC)||pipe2(gate,O_CLOEXEC)) die();
  pid_t pid=fork();if(pid<0) die();
  if(pid==0) {
    close(conn);close(ready[0]);close(gate[1]);
    for(int i=0;i<3;i++) if(dup2(stdio[i],i)<0) die();
    for(int i=0;i<3;i++) if(stdio[i]>2) close(stdio[i]);
    confined_exec(&s,ready[1],gate[0]);
  }
  close(ready[1]);close(gate[0]);for(int i=0;i<3;i++) close(stdio[i]);
  char state[2];if(read_exact(ready[0],state,2)||memcmp(state,"R\n",2)) die();close(ready[0]);
  char report[64];int n=snprintf(report,sizeof(report),"R %ld\n",(long)pid);
  if(n<1||(size_t)n>=sizeof(report)||write_all(3,report,(size_t)n)) die();
  sdk_still_alive(sdk_pidfd);
  if(read_exact(4,state,1)||state[0]!='G'||write_all(gate[1],"G",1)) {kill(pid,SIGKILL);die();}close(gate[1]);
  int status;if(waitpid(pid,&status,0)!=pid) die();
  char result=(WIFEXITED(status)&&WEXITSTATUS(status)==0)?'0':'1';
  (void)write_all(conn,&result,1);close(conn);
  _exit(result=='0'?0:FAIL);
}
int main(int argc,char **argv) {
  require_root();
  if(argc<2) die();
  if(!strcmp(argv[1],"run")) {spec s=parse_spec(argc,argv,2);if(strcmp(s.kind,"sdk")&&strcmp(s.kind,"relay-sdk")&&strcmp(s.kind,"relay-browser")) die();direct_run(&s);}
  if(!strcmp(argv[1],"broker")) broker_run(argc,argv);
  die();
}
