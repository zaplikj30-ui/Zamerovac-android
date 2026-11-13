"""Bridge protocol/guard fixtures; never invokes real Windows or WSL."""
import importlib.util
import io
from pathlib import Path
import json
import sys
import unittest
from unittest import mock

SPEC=importlib.util.spec_from_file_location('wsl_bridge_contract',Path(__file__).resolve().parents[1]/'tools/home_qa_wsl_bridge.py')
bridge=importlib.util.module_from_spec(SPEC)
with mock.patch.object(sys,'path',[str(Path(__file__).resolve().parents[1]/'tools'),*sys.path]):
    SPEC.loader.exec_module(bridge)


class BridgeContractTests(unittest.TestCase):
    def test_linux_blocks_before_any_wsl_or_process_call(self):
        with mock.patch.object(bridge.sys,'platform','linux'), \
             mock.patch.object(bridge.subprocess,'check_output') as read, \
             mock.patch.object(bridge.subprocess,'Popen') as start:
            with self.assertRaisesRegex(RuntimeError,'Windows service'):
                bridge.check_context('a'*40)
            read.assert_not_called();start.assert_not_called()

    def test_fixed_distribution_and_no_privileged_switches(self):
        self.assertEqual(bridge.command('id','-u'),[bridge.WSL,'--distribution','Zamerovac-Ubuntu-QA','--exec','id','-u'])

    def test_cancel_crosses_pipe_as_protocol_and_validates_returned_identities(self):
        members=[{'pid':p,'pgid':123,'sid':123,'uid':1000,'start':p} for p in (123,124,125)]
        ready={'event':'ready','members':members}
        result={'status':'PASS','reason':'cancel','cleanupVerified':True,'reaped':[123,124,125]}
        stdin=mock.Mock(closed=False)
        proc=mock.Mock(stdin=stdin,stdout=io.StringIO(json.dumps(ready)+'\n'+json.dumps(result)+'\n'),stderr=io.StringIO(),returncode=0)
        proc.poll.return_value=0
        with mock.patch.object(bridge.subprocess,'Popen',return_value=proc), \
             mock.patch.object(bridge.subprocess,'run') as verify:
            self.assertEqual(bridge.one_probe('/mnt/c/approved/gate','cancel',1000)['status'],'PASS')
            stdin.write.assert_called_once_with('QA_CANCEL\n')
            proc.terminate.assert_not_called()
            self.assertIn("os.path.exists",verify.call_args.args[0][6])


if __name__=='__main__':unittest.main()
