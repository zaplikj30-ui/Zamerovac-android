"""One-shot real Windows native token and empty JobObject probe; NEVER start worker."""
import json
import sys

def show(status, step, *, error=None, diagnostic=None, empty=False, closed=False):
    d=diagnostic or {}
    print("QA34_WINDOWS_NATIVE "+json.dumps({
        "status":status,"scope":"TOKEN_AND_EMPTY_JOB_ONLY","step":step,
        "errorType":error,"win32Stage":d.get("stage"),
        "win32Error":d.get("win32Error"),
        "ownedProcessCount":0 if empty else None,
        "cleanupVerified":bool(empty and closed),"handleClosed":bool(closed),
        "workerStarted":False,
    },sort_keys=True),flush=True)

def main():
    if sys.platform!="win32":
        show("BLOCKED","platform")
        return 77
    try:
        from qa_owned_processes import new_scope, scope_diagnostic
    except BaseException as exc:
        show("BLOCKED","import",error=type(exc).__name__)
        return 77
    scope=None
    first=None
    stage="new-scope"
    empty=False
    closed=False
    try:
        scope=new_scope()  # Verify current token; CreateJobObject + KILL_ON_JOB_CLOSE.
        stage="verify-empty"
        empty=scope.verify_empty() is True
        if not empty:raise RuntimeError("unexpected active process in new job")
    except BaseException as exc:
        first=(stage,type(exc).__name__,scope_diagnostic(exc,stage))
    finally:
        if scope is not None:
            try:
                scope.close()
                closed=True
            except BaseException as exc:
                if first is None:
                    first=("close",type(exc).__name__,scope_diagnostic(exc,"unknown"))
    if first:
        step,error,diagnostic=first
        show("BLOCKED",step,error=error,diagnostic=diagnostic,empty=empty,closed=closed)
        return 77
    show("PASS","native-job-empty-closed",empty=empty,closed=closed)
    return 0

if __name__=="__main__":
    sys.exit(main())
