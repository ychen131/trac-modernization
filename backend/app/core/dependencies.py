from fastapi import HTTPException, Request

def get_trac_env(request: Request):
    if not hasattr(request.app.state, 'trac_env') or request.app.state.trac_env is None:
        raise HTTPException(status_code=503, detail="Trac environment not available")
    return request.app.state.trac_env 