#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <grp.h>
#include <linux/capability.h>
#include <linux/magic.h>
#include <sched.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mount.h>
#include <sys/file.h>
#include <sys/prctl.h>
#include <sys/stat.h>
#include <sys/statfs.h>
#include <sys/syscall.h>
#include <sys/types.h>
#include <unistd.h>

/* Root-owned, non-setuid helper for one unprivileged host-veth relay process. Invoke only from the trusted root
 * supervisor. The caller must pin this binary and Node/script hashes. No tenant or tool process may execute it. */
#ifndef NSFS_MAGIC
#define NSFS_MAGIC 0x6e736673
#endif
#ifndef PR_CAP_AMBIENT_CLEAR_ALL
#define PR_CAP_AMBIENT_CLEAR_ALL 4
#endif
#define FAIL 111

static void die(void) { _exit(FAIL); }
static int write_all(int fd,const char *p,size_t n) {
 while(n) {ssize_t done=write(fd,p,n);if(done<0&&errno==EINTR)continue;if(done<=0)return -1;p+=done;n-=(size_t)done;}return 0;
}
static unsigned long long decimal(const char *s,unsigned long long max) {
 if(!s||!*s)die();
 unsigned long long n=0;
 for(const char *p=s;*p;p++){if(*p<'0'||*p>'9'||n>(max-(unsigned)(*p-'0'))/10)die();n=n*10+(unsigned)(*p-'0');}return n;
}
static int hex64(const char *s) {
 if(!s||strlen(s)!=64)return 0;
 for(int i=0;i<64;i++)if(!((s[i]>='0'&&s[i]<='9')||(s[i]>='a'&&s[i]<='f')))return 0;
 return 1;
}
static int uuid(const char *s) {
 if(!s||strlen(s)!=36)return 0;
 for(int i=0;i<36;i++){
  if(i==8||i==13||i==18||i==23){if(s[i]!='-')return 0;}
  else if(!((s[i]>='0'&&s[i]<='9')||(s[i]>='a'&&s[i]<='f')))return 0;
 }
 return 1;
}
static int absolute(const char *s) {
 if(!s||s[0]!='/'||strlen(s)>4095)return 0;
 for(const char *p=s+1;*p;){const char *end=strchr(p,'/');size_t n=end?(size_t)(end-p):strlen(p);
  if(!n||(n==1&&p[0]=='.')||(n==2&&p[0]=='.'&&p[1]=='.'))return 0;
  if(!end)break;
  p=end+1;if(!*p)return 0;
 }
 return 1;
}
static void safe_dir(int fd) {
 struct stat st;if(fd<0||fstat(fd,&st)||!S_ISDIR(st.st_mode)||st.st_uid!=0||(st.st_mode&0022))die();
}
static void root_file(const char *path,int executable) {
 if(!absolute(path))die();
 int dir=open("/",O_PATH|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);safe_dir(dir);
 const char *part=path+1;
 for(const char *slash=strchr(part,'/');slash;slash=strchr(part,'/')){
  size_t n=(size_t)(slash-part);char name[256];if(n<1||n>=sizeof(name))die();
  memcpy(name,part,n);name[n]='\0';
  int next=openat(dir,name,O_PATH|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);safe_dir(next);
  close(dir);dir=next;part=slash+1;
 }
 if(!*part||strlen(part)>255)die();
 int fd=openat(dir,part,O_RDONLY|O_NOFOLLOW|O_CLOEXEC);close(dir);struct stat st;
 if(fd<0||fstat(fd,&st)||!S_ISREG(st.st_mode)||st.st_uid!=0||(st.st_mode&0022)||
    (executable&&!(st.st_mode&0111)))die();
 close(fd);
}
static int child_dir(int parent,const char *name) {
 if(mkdirat(parent,name,0755)&&errno!=EEXIST)die();
 int fd=openat(parent,name,O_PATH|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);safe_dir(fd);return fd;
}
static int launch_lock(const char *binding,const char *kind) {
 int run=open("/run",O_PATH|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);safe_dir(run);
 int locks=child_dir(run,"meri-host-relay");close(run);
 char name[96];if(snprintf(name,sizeof(name),"%s-%s.lock",binding,kind)>=(int)sizeof(name))die();
 int fd=openat(locks,name,O_RDWR|O_CREAT|O_NOFOLLOW|O_CLOEXEC,0600);close(locks);
 struct stat st;if(fd<0||fstat(fd,&st)||!S_ISREG(st.st_mode)||st.st_uid!=0||(st.st_mode&0077)||flock(fd,LOCK_EX|LOCK_NB))die();
 return fd; /* close_range releases it only after the paused child receives GO. */
}
static void require_host_network(unsigned long long dev,unsigned long long ino) {
 int init=open("/proc/1/ns/net",O_RDONLY|O_CLOEXEC),self=open("/proc/self/ns/net",O_RDONLY|O_CLOEXEC);
 struct stat a,b;struct statfs af,bf;
 if(init<0||self<0||fstat(init,&a)||fstat(self,&b)||fstatfs(init,&af)||fstatfs(self,&bf)||
    af.f_type!=NSFS_MAGIC||bf.f_type!=NSFS_MAGIC||a.st_dev!=b.st_dev||a.st_ino!=b.st_ino||
    (unsigned long long)a.st_dev!=dev||(unsigned long long)a.st_ino!=ino)die();
 close(init);close(self);
}
static void attach_cgroup(const char *host,const char *generation,const char *binding,const char *kind) {
 int root=open("/sys/fs/cgroup/meri/hosts",O_PATH|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);struct statfs fs;
 if(root<0||fstatfs(root,&fs)||fs.f_type!=CGROUP2_SUPER_MAGIC)die();
 safe_dir(root);
 char generation_name[64],leaf_name[32];
 if(snprintf(generation_name,sizeof(generation_name),"%s-%s",host,generation)>=(int)sizeof(generation_name)||
    snprintf(leaf_name,sizeof(leaf_name),"host-relay-%s",kind)>=(int)sizeof(leaf_name))die();
 int parent=child_dir(root,generation_name),run=child_dir(parent,binding),leaf=child_dir(run,leaf_name);
 close(root);close(parent);close(run);
 int procs=openat(leaf,"cgroup.procs",O_RDWR|O_NOFOLLOW|O_CLOEXEC);if(procs<0)die();
 char occupied[2];ssize_t read_count=read(procs,occupied,sizeof(occupied));if(read_count!=0)die();
 char pid[32];int n=snprintf(pid,sizeof(pid),"%ld",(long)getpid());
 if(n<1||(size_t)n>=sizeof(pid)||write_all(procs,pid,(size_t)n))die();
 close(procs);
 procs=openat(leaf,"cgroup.procs",O_RDONLY|O_NOFOLLOW|O_CLOEXEC);if(procs<0)die();
 char only[64]={0};
 ssize_t size=read(procs,only,sizeof(only)-1);
 if(size!=n+1||memcmp(only,pid,(size_t)n)||only[n]!='\n')die();
 close(procs);close(leaf);
 char expected[256],observed[256]={0};
 n=snprintf(expected,sizeof(expected),"0::/meri/hosts/%s-%s/%s/%s\n",host,generation,binding,leaf_name);
 if(n<1||(size_t)n>=sizeof(expected))die();
 int actual=open("/proc/self/cgroup",O_RDONLY|O_NOFOLLOW|O_CLOEXEC);if(actual<0)die();
 ssize_t count=read(actual,observed,sizeof(observed)-1);close(actual);
 if(count!=n||memcmp(expected,observed,(size_t)n))die();
}
static void hide_cgroupfs(void) {
 if(unshare(CLONE_NEWNS)||mount(NULL,"/",NULL,MS_PRIVATE|MS_REC,NULL)||umount2("/sys/fs/cgroup",MNT_DETACH)||
    mount("tmpfs","/sys/fs/cgroup","tmpfs",MS_NOSUID|MS_NODEV|MS_NOEXEC,"size=4096,mode=000")||
    mount(NULL,"/sys/fs/cgroup",NULL,MS_REMOUNT|MS_RDONLY|MS_NOSUID|MS_NODEV|MS_NOEXEC,NULL))die();
}
static void drop(unsigned long uid,unsigned long gid) {
 if(chdir("/")||setgroups(0,NULL))die();
 for(int cap=0;cap<=CAP_LAST_CAP;cap++)if(prctl(PR_CAPBSET_DROP,cap,0,0,0)&&errno!=EINVAL)die();
 if(prctl(PR_CAP_AMBIENT,PR_CAP_AMBIENT_CLEAR_ALL,0,0,0)||setresgid((gid_t)gid,(gid_t)gid,(gid_t)gid)||
    setresuid((uid_t)uid,(uid_t)uid,(uid_t)uid)||prctl(PR_SET_NO_NEW_PRIVS,1,0,0,0))die();
 struct __user_cap_header_struct h={_LINUX_CAPABILITY_VERSION_3,0};struct __user_cap_data_struct d[2]={{0}};
 if(syscall(SYS_capset,&h,d)||getuid()!=uid||geteuid()!=uid||getgid()!=gid||getegid()!=gid)die();
}
int main(int argc,char **argv) {
 if(getuid()!=0||geteuid()!=0||getgid()!=0||getegid()!=0||argc!=14||strcmp(argv[1],"run")||
    !uuid(argv[2])||!hex64(argv[4])||(strcmp(argv[5],"sdk")&&strcmp(argv[5],"browser")))die();
 unsigned long long generation=decimal(argv[3],999999999),ns_dev=decimal(argv[6],UINT64_MAX),ns_ino=decimal(argv[7],UINT64_MAX);
 unsigned long uid=decimal(argv[8],65533),gid=decimal(argv[9],65533);
 if(generation<1||uid<1000||gid<1000||!absolute(argv[10])||!absolute(argv[11])||
    strcmp(argv[12],"/")||strlen(argv[13])>4096)die();
 for(const char *p=argv[13];*p;p++)if(!((*p>='A'&&*p<='Z')||(*p>='a'&&*p<='z')||(*p>='0'&&*p<='9')||*p=='_'||*p=='-'))die();
 root_file(argv[10],1);root_file(argv[11],0);
 require_host_network(ns_dev,ns_ino);pid_t parent=getppid();if(parent<2)die();
 int lock=launch_lock(argv[4],argv[5]);(void)lock;
 attach_cgroup(argv[2],argv[3],argv[4],argv[5]);
 hide_cgroupfs();drop(uid,gid);
 if(prctl(PR_SET_PDEATHSIG,SIGKILL)||getppid()!=parent)die();
 require_host_network(ns_dev,ns_ino);
 if(write_all(3,"R\n",2))die();
 char go;if(read(4,&go,1)!=1||go!='G'||close_range(3,~0U,0))die();
 char *args[]={argv[10],argv[11],argv[13],NULL};
 char *env[]={"PATH=/usr/bin:/bin","HOME=/","LANG=C.UTF-8",NULL};
 if(clearenv())die();
 execve(argv[10],args,env);die();
}
