"""Kernel identity race fixtures: never signal a real process."""
import importlib.util
from pathlib import Path
import unittest
from unittest import mock

SPEC=importlib.util.spec_from_file_location('owned_identity',Path(__file__).resolve().parents[1]/'tools/qa_owned_processes.py')
owned=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(owned)


class IdentityRaceTests(unittest.TestCase):
    def test_reused_ancestor_pid_does_not_admit_foreign_descendant(self):
        scope=owned.LinuxScope.__new__(owned.LinuxScope);scope.fds={};scope.observed=[]
        calls=0
        def info(pid):
            nonlocal calls
            if pid==200:
                calls+=1
                return {'pid':200,'ppid':100 if calls==1 else 1,'uid':1000,'start':1 if calls==1 else 2}
            if pid==300:return {'pid':300,'ppid':200,'uid':1000,'start':3}
            return None
        with mock.patch.object(owned.os,'getpid',return_value=100), \
             mock.patch.object(owned.os,'geteuid',return_value=1000,create=True), \
             mock.patch.object(owned.Path,'iterdir',return_value=[Path('/proc/200'),Path('/proc/300')]), \
             mock.patch.object(owned,'proc_info',side_effect=info), \
             mock.patch.object(owned.os,'pidfd_open',return_value=99,create=True), \
             mock.patch.object(owned.os,'close'):
            scope.capture()
        self.assertNotIn((300,3),scope.fds,'stale numeric ancestry must never confer ownership')


if __name__=='__main__':unittest.main()
