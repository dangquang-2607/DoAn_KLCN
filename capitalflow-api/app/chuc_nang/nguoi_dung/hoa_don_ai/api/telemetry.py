"""Aggregate-friendly invoice metrics; never log request bodies or identity data."""
import json
import logging
from time import perf_counter
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

logger = logging.getLogger('capitalflow.invoice_metrics')


class InvoiceMetricsRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def measured(request):
            started = perf_counter()
            metric = {'operation': self.name, 'method': request.method, 'status': 500}
            try:
                response = await handler(request)
                metric['status'] = response.status_code
                # Whitelist only bounded enum values; file/JSON payloads never reach the logger.
                if isinstance(response, JSONResponse) and len(response.body) < 65536:
                    try:
                        data = json.loads(response.body)
                        if isinstance(data, dict):
                            if data.get('outcome') in {'CREATED', 'REUSED_DRAFT', 'ALREADY_CONFIRMED', 'RESTORE_REQUIRED'}:
                                metric['outcome'] = data['outcome']
                            if data.get('level') in {'NONE', 'SUSPECTED', 'EXACT'}:
                                metric['duplicate_level'] = data['level']
                    except (ValueError, UnicodeError, TypeError):
                        pass
                return response
            except RequestValidationError:
                metric['status'] = 422
                raise
            except HTTPException as exc:
                metric['status'] = exc.status_code
                if isinstance(exc.detail, dict):
                    code = exc.detail.get('code', '')
                    if isinstance(code, str) and code.isascii() and len(code) <= 64 and code.replace('_', '').isupper():
                        metric['error_code'] = code
                raise
            finally:
                metric['handler_ms'] = round((perf_counter() - started) * 1000, 2)
                logger.info('invoice_metric %s', json.dumps(metric, separators=(',', ':')))

        return measured
