/* Focused permission regression for the host relay's post-drop network pin.
 * Build and run as a nonroot user:
 *   cc -std=c11 -Wall -Wextra -Werror -O2 -o /tmp/meri-host-relay-namespace-test meri-host-relay-namespace-test.c
 *   /tmp/meri-host-relay-namespace-test
 * This includes the actual launcher function without invoking its root/cgroup setup. */
/* A renamed C main loses the language's implicit final return 0. */
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wreturn-type"
#define main meri_host_relay_launcher_main
#include "meri-host-relay-launcher.c"
#undef main
#pragma GCC diagnostic pop

#include <sys/wait.h>

static void test_fail(const char *message) {
 fprintf(stderr,"FAIL: %s\n",message);
 exit(1);
}
static void expect_byte(int fd,char expected) {
 char actual=0;ssize_t count;
 do {count=read(fd,&actual,1);} while(count<0&&errno==EINTR);
 if(count!=1||actual!=expected)test_fail("unexpected child handshake");
}
static void send_byte(int fd,char value) {
 if(write_all(fd,&value,1))test_fail("child handshake write failed");
}
static void expect_exit(pid_t child,int expected) {
 int status=0;pid_t result;
 do {result=waitpid(child,&status,0);} while(result<0&&errno==EINTR);
 if(result!=child||!WIFEXITED(status)||WEXITSTATUS(status)!=expected)test_fail("unexpected child exit");
}
int main(void) {
 if(geteuid()==0)test_fail("run this permission regression as a nonroot user");
 alarm(10);
 int ready[2],control[2];
 if(pipe2(ready,O_CLOEXEC)||pipe2(control,O_CLOEXEC))test_fail("pipe setup failed");
 pid_t protected=fork();
 if(protected<0)test_fail("protected process fork failed");
 if(protected==0){
  close(ready[0]);close(control[1]);
  pid_t parent=getppid();
  if(prctl(PR_SET_PDEATHSIG,SIGKILL)||getppid()!=parent)_exit(2);
  send_byte(ready[1],'R');expect_byte(control[0],'D');
  if(prctl(PR_SET_DUMPABLE,0))_exit(3);
  send_byte(ready[1],'D');expect_byte(control[0],'Q');
  _exit(0);
 }
 close(ready[1]);close(control[0]);expect_byte(ready[0],'R');
 char path[64];
 if(snprintf(path,sizeof(path),"/proc/%ld/ns/net",(long)protected)>=(int)sizeof(path))test_fail("proc path too long");
 int pin=open(path,O_RDONLY|O_CLOEXEC);struct stat pinned;
 if(pin<0||fstat(pin,&pinned))test_fail("could not pin child namespace before permission loss");
 send_byte(control[1],'D');expect_byte(ready[0],'D');
 int fresh=open(path,O_RDONLY|O_CLOEXEC);
 if(fresh>=0){close(fresh);test_fail("fresh protected proc namespace open unexpectedly succeeded");}
 if(errno!=EACCES&&errno!=EPERM)test_fail("fresh protected proc namespace open did not fail for permissions");
 unsigned long long dev=(unsigned long long)pinned.st_dev,ino=(unsigned long long)pinned.st_ino;
 require_pinned_host_network(pin,dev,ino);
 pid_t mismatch=fork();
 if(mismatch<0)test_fail("mismatch fork failed");
 if(mismatch==0){require_pinned_host_network(pin,dev,ino^1ULL);_exit(0);}
 expect_exit(mismatch,FAIL);
 close(pin);send_byte(control[1],'Q');expect_exit(protected,0);
 close(control[1]);close(ready[0]);
 puts("PASS: protected proc open denied, pinned namespace accepted, mismatched identity refused");
 return 0;
}
