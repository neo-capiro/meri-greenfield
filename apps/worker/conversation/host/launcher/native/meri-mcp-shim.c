#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/un.h>
#include <unistd.h>

/* Unprivileged stdio shim used as the SDK's MCP command. The request carries only its stdio FDs and a single-use
 * nonce. The root broker checks SO_PEERCRED and already owns the complete Playwright command and isolation pins. */
static void die(void) { _exit(111); }
static int valid_hex(const char *s,size_t n) {
  if(!s||strlen(s)!=n) return 0;
  for(size_t i=0;i<n;i++) if(!((s[i]>='0'&&s[i]<='9')||(s[i]>='a'&&s[i]<='f'))) return 0;
  return 1;
}
int main(int argc,char **argv) {
  if(clearenv()) die();
  if(argc!=3||!argv[1]||!argv[2]||!valid_hex(argv[2],64)) die();
  const char *prefix="/run/meri-launch/";size_t plen=strlen(prefix);
  if(strlen(argv[1])!=plen+64+5||strncmp(argv[1],prefix,plen)||
     strcmp(argv[1]+plen+64,".sock")) die();
  char digest[65];memcpy(digest,argv[1]+plen,64);digest[64]='\0';
  if(!valid_hex(digest,64)) die();
  int fd=socket(AF_UNIX,SOCK_STREAM|SOCK_CLOEXEC,0);
  if(fd<0) die();
  struct sockaddr_un a={.sun_family=AF_UNIX};
  if(strlen(argv[1])>=sizeof(a.sun_path)) die();
  strcpy(a.sun_path,argv[1]);
  if(connect(fd,(struct sockaddr *)&a,sizeof(a))) die();
  struct ucred peer;socklen_t size=sizeof(peer);
  if(getsockopt(fd,SOL_SOCKET,SO_PEERCRED,&peer,&size)||size!=sizeof(peer)||peer.uid!=0) die();
  struct iovec iov={.iov_base=argv[2],.iov_len=64};
  char control[CMSG_SPACE(sizeof(int)*3)]={0};
  struct msghdr msg={.msg_iov=&iov,.msg_iovlen=1,.msg_control=control,.msg_controllen=sizeof(control)};
  struct cmsghdr *c=CMSG_FIRSTHDR(&msg);if(!c) die();
  c->cmsg_level=SOL_SOCKET;c->cmsg_type=SCM_RIGHTS;c->cmsg_len=CMSG_LEN(sizeof(int)*3);
  int stdio[3]={0,1,2};memcpy(CMSG_DATA(c),stdio,sizeof(stdio));
  if(sendmsg(fd,&msg,MSG_NOSIGNAL)!=64) die();
  /* The broker owns the stdio FDs now. A result byte arrives only after the prebound MCP child exits. */
  char result;ssize_t n;do{n=read(fd,&result,1);}while(n<0&&errno==EINTR);
  close(fd);return n==1&&result=='0'?0:111;
}
