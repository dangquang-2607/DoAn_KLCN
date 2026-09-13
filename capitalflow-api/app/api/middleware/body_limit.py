from starlette.responses import JSONResponse

class BodyLimitMiddleware:
    def __init__(self, app, max_bytes=12*1024*1024):
        self.app,self.max_bytes=app,max_bytes
    async def __call__(self,scope,receive,send):
        if scope["type"]!="http":return await self.app(scope,receive,send)
        headers=dict(scope.get("headers",[]))
        limit=self.max_bytes if scope.get("path")=="/api/v1/invoices" else 256*1024
        try:length=int(headers.get(b"content-length",b"0"))
        except ValueError:length=limit+1
        if length>limit:
            return await JSONResponse({"detail":"Request body quá lớn"},status_code=413)(scope,receive,send)
        size=0;exceeded=False
        async def bounded_receive():
            nonlocal size,exceeded
            message=await receive()
            size+=len(message.get("body",b""))
            if size>limit:
                exceeded=True
                raise ValueError("Request body limit exceeded")
            return message
        async def bounded_send(message):
            if exceeded:
                if message["type"]=="http.response.start":
                    message={"type":"http.response.start","status":413,"headers":[(b"content-type",b"application/json")]}
                elif message["type"]=="http.response.body":
                    message={"type":"http.response.body","body":b'{"detail":"Request body too large"}',"more_body":False}
            await send(message)
        await self.app(scope,bounded_receive,bounded_send)
