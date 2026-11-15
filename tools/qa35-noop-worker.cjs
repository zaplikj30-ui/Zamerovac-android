'use strict';
// Inert one-shot child: no filesystem access, no grandchildren, no network.
const authorized=process.platform==='win32'&&process.argv.length===2&&
 process.env.ZAMEROVAC_SCOPE==='windows-private-job'&&
 process.env.ZAMEROVAC_SUPERVISOR_PID===String(process.ppid);
if(authorized){process.stdout.write('QA35_NOOP_EXIT0\n');process.exitCode=0;}
else{process.exitCode=77;}
