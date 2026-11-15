"""Check the Windows test dispatch without running any native Windows workload."""
import importlib.util
from pathlib import Path
import sys
import unittest
from unittest import mock


class IntegrationBoundaries(unittest.TestCase):
    def test_windows_supervisor_fault_suite_is_not_automatically_executed(self):
        path=Path(__file__).with_name('test_qa_process_supervisor.py')
        spec=importlib.util.spec_from_file_location('windows_dispatch_model',path)
        module=importlib.util.module_from_spec(spec)
        with mock.patch.object(sys,'platform','win32'):
            spec.loader.exec_module(module)
        self.assertTrue(module.OwnedRunnerTests.__unittest_skip__)
        self.assertIn('native Windows fault testing requires separate isolated approval',
                      module.OwnedRunnerTests.__unittest_skip_why__)
        self.assertEqual(unittest.defaultTestLoader.loadTestsFromTestCase(module.OwnedRunnerTests).countTestCases(),11)
        self.assertTrue(module.FixturePreparationTests.__unittest_skip__)
        self.assertEqual(module.FixturePreparationTests.__unittest_skip_why__,
                         module.OwnedRunnerTests.__unittest_skip_why__)
        self.assertEqual(unittest.defaultTestLoader.loadTestsFromTestCase(module.FixturePreparationTests).countTestCases(),5)


if __name__=='__main__':unittest.main()
