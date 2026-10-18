"""Offline product callback checks; no LiteLLM import or provider call."""
import asyncio
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from apps.proxy.product import upstream_callback as product
from apps.proxy.product.upstream_callback import create_product_litellm_invoker


class _CustomLogger:
    async def async_pre_call_deployment_hook(self, kwargs, call_type):
        return kwargs


class _Handler:
    def __init__(self):
        self._product_native_dispatch_evidence = product.ProductNativeDispatchEvidence()

    async def close(self):
        pass


def _scope():
    return {"type": "http", "scheme": "https", "method": "POST",
            "path": "/v1/messages", "raw_path": b"/v1/messages",
            "query_string": b"beta=true"}


async def _send(_event):
    pass


class NativeCallbackTests(unittest.IsolatedAsyncioTestCase):
    async def test_pinned_loader_uses_only_real_module_names(self):
        # Real 1.104.2 registers its native model-budget limiter when proxy_server is imported.
        class _Limiter:
            pass
        module = SimpleNamespace(__name__="litellm", callbacks=[_Limiter()])
        native = SimpleNamespace(__name__="litellm.proxy.proxy_server",
                                 app=lambda *_args: None)
        logger = SimpleNamespace(__name__="litellm.integrations.custom_logger",
                                 CustomLogger=_CustomLogger)
        limiter = SimpleNamespace(__name__="litellm.proxy.hooks.model_max_budget_limiter",
                                  _PROXY_VirtualKeyModelMaxBudgetLimiter=_Limiter)
        lifespan_names = (
            ("litellm.proxy.hooks.parallel_request_limiter_v3", "_PROXY_MaxParallelRequestsHandler_v3"),
            ("litellm.proxy.hooks.cache_control_check", "_PROXY_CacheControlCheck"),
            ("litellm.proxy.hooks.responses_id_security", "ResponsesIDSecurity"),
            ("litellm.proxy.hooks.litellm_skills.main", "SkillsInjectionHook"),
            ("litellm.proxy.hooks.max_iterations_limiter", "_PROXY_MaxIterationsHandler"),
            ("litellm.proxy.hooks.max_budget_per_session_limiter", "_PROXY_MaxBudgetPerSessionHandler"),
            ("litellm.proxy.hooks.sensitive_data_routing", "_PROXY_SensitiveDataRoutingHandler"),
            ("litellm.proxy.hooks.prompt_cache_prediction", "PromptCacheObserver"),
            ("litellm._service_logger", "ServiceLogging"))
        lifespan_modules = [SimpleNamespace(__name__=m, **{c: type(c, (), {})}) for m, c in lifespan_names]
        imported = {item.__name__: item for item in (module, native, logger, limiter, *lifespan_modules)}
        with (patch.object(product.metadata, "version", return_value="1.104.2") as version,
              patch.object(product, "import_module", side_effect=imported.__getitem__)):
            invoke = product.load_pinned_product_litellm_invoker()
        self.assertTrue(callable(invoke))
        self.assertEqual(len(module.callbacks), 2)
        self.assertIs(type(module.callbacks[0]), _Limiter)
        version.assert_called_once_with("litellm")
        # The pinned native lifespan appends its hooks after ours; registration stays current.
        module.callbacks.extend(getattr(m, c)() for m, (_, c) in zip(lifespan_modules, lifespan_names))
        self.assertTrue(invoke.registration_current())

        wrong = SimpleNamespace(__name__="not-litellm", callbacks=[])
        imported["litellm"] = wrong
        with (patch.object(product.metadata, "version", return_value="1.104.2"),
              patch.object(product, "import_module", side_effect=imported.__getitem__)):
            with self.assertRaisesRegex(Exception, "PRODUCT_NATIVE_LITELLM_REFUSED"):
                product.load_pinned_product_litellm_invoker()

    async def test_native_baseline_is_exact_and_registration_detects_drift(self):
        class _Limiter:
            pass
        class _Other:
            pass
        app = lambda *_args: None
        for callbacks in ([_Other()], [_Limiter(), _Limiter()], [_Limiter(), _Other()], []):
            with self.subTest(callbacks=[type(c).__name__ for c in callbacks]):
                module = SimpleNamespace(callbacks=list(callbacks))
                with self.assertRaisesRegex(Exception, "PRODUCT_NATIVE_LITELLM_REFUSED"):
                    product.create_product_litellm_invoker(native_app=app, litellm_module=module,
                        callback_base=_CustomLogger, native_baseline_types=(_Limiter,))
        for bad in ([_Limiter], (_Limiter, _Limiter), (_Limiter()),):
            with self.assertRaisesRegex(Exception, "PRODUCT_NATIVE_LITELLM_REFUSED"):
                product.create_product_litellm_invoker(native_app=app, litellm_module=SimpleNamespace(callbacks=[_Limiter()]),
                    callback_base=_CustomLogger, native_baseline_types=bad)
        base = _Limiter(); module = SimpleNamespace(callbacks=[base])
        invoke = product.create_product_litellm_invoker(native_app=app, litellm_module=module,
            callback_base=_CustomLogger, native_baseline_types=(_Limiter,))
        hook = module.callbacks[1]
        for drift in ([base, hook, _Other()], [hook], [_Limiter(), hook], [base]):
            module.callbacks[:] = drift
            with self.assertRaisesRegex(Exception, "PRODUCT_NATIVE_LITELLM_REFUSED"):
                await invoke(_Handler(), _scope(), lambda: None, _send)
        module.callbacks[:] = [base, hook]

    async def test_lifespan_hooks_are_an_exact_allowlist(self):
        class _Limiter: pass
        class _A: pass
        class _B: pass
        class _Other: pass
        app = lambda *_args: None
        base = _Limiter(); module = SimpleNamespace(callbacks=[base])
        invoke = product.create_product_litellm_invoker(native_app=app, litellm_module=module,
            callback_base=_CustomLogger, native_baseline_types=(_Limiter,), native_lifespan_types=(_A, _B))
        hook = module.callbacks[1]
        for good in ([base, hook], [base, hook, _A()], [base, hook, _B(), _A()]):
            module.callbacks[:] = good
            self.assertTrue(invoke.registration_current())
        for bad in ([base, hook, _Other()], [base, hook, _A(), _A()], [base, _A(), hook], [hook, base], [base, hook, hook]):
            module.callbacks[:] = bad
            self.assertFalse(invoke.registration_current())
        for overlap in ((_Limiter,), (_A, _A), [_A]):
            with self.assertRaisesRegex(Exception, "PRODUCT_NATIVE_LITELLM_REFUSED"):
                product.create_product_litellm_invoker(native_app=app, litellm_module=SimpleNamespace(callbacks=[_Limiter()]),
                    callback_base=_CustomLogger, native_baseline_types=(_Limiter,), native_lifespan_types=overlap)

    async def test_wrong_distribution_refuses_before_import(self):
        with (patch.object(product.metadata, "version", return_value="1.104.1"),
              patch.object(product, "import_module") as imported):
            with self.assertRaisesRegex(Exception, "PRODUCT_NATIVE_LITELLM_REFUSED"):
                product.load_pinned_product_litellm_invoker()
        imported.assert_not_called()

    async def test_native_asgi_uses_registered_one_request_handler(self):
        module = SimpleNamespace(callbacks=[])
        handler = _Handler()
        seen = []

        async def native(scope, receive, send):
            self.assertIs(scope, request_scope)
            result = await module.callbacks[0].async_pre_call_deployment_hook(
                {"model": "meri-sonnet-qualification"}, "anthropic_messages")
            seen.append(result)
            handler._product_native_dispatch_evidence.mark_entered()
            await send({"type": "http.response.start", "status": 200, "headers": []})
            handler._product_native_dispatch_evidence.mark_settled()
            await send({"type": "http.response.body", "body": b"ok"})

        invoke = create_product_litellm_invoker(
            native_app=native, litellm_module=module, callback_base=_CustomLogger)
        request_scope = _scope()
        sent = []
        async def collect(event):
            sent.append(event)
        await invoke(handler, request_scope, lambda: None, collect)
        self.assertEqual(len(module.callbacks), 1)
        self.assertIs(seen[0]["client"], handler)
        self.assertEqual([event["type"] for event in sent],
                         ["http.response.start", "http.response.body"])
        with self.assertRaisesRegex(Exception, "PRODUCT_NATIVE_LITELLM_REFUSED"):
            await module.callbacks[0].async_pre_call_deployment_hook({}, "anthropic_messages")

    async def test_missing_or_changed_registration_never_enters_native_app(self):
        module = SimpleNamespace(callbacks=[])
        entered = []

        async def native(*_args):
            entered.append(True)

        invoke = create_product_litellm_invoker(
            native_app=native, litellm_module=module, callback_base=_CustomLogger)
        module.callbacks.clear()
        with self.assertRaisesRegex(Exception, "PRODUCT_NATIVE_LITELLM_REFUSED"):
            await invoke(_Handler(), _scope(), lambda: None, _send)
        self.assertEqual(entered, [])

    async def test_success_without_deployment_hook_refuses(self):
        module = SimpleNamespace(callbacks=[])
        sent = []

        async def native(_scope, _receive, send):
            await send({"type": "http.response.start", "status": 200, "headers": []})

        invoke = create_product_litellm_invoker(
            native_app=native, litellm_module=module, callback_base=_CustomLogger)
        with self.assertRaisesRegex(Exception, "PRODUCT_NATIVE_LITELLM_REFUSED"):
            await invoke(_Handler(), _scope(), lambda: None, _send)
        self.assertEqual(sent, [])

    async def test_hook_without_native_transport_or_settlement_cannot_complete_success(self):
        for phase in ("no-transport", "no-settlement"):
            module = SimpleNamespace(callbacks=[])
            handler = _Handler()
            sent = []

            async def native(_scope, _receive, send):
                await module.callbacks[0].async_pre_call_deployment_hook(
                    {}, "anthropic_messages")
                if phase == "no-settlement":
                    handler._product_native_dispatch_evidence.mark_entered()
                await send({"type": "http.response.start", "status": 200, "headers": []})
                await send({"type": "http.response.body", "body": b"fake"})

            async def collect(event):
                sent.append(event)

            invoke = create_product_litellm_invoker(
                native_app=native, litellm_module=module, callback_base=_CustomLogger)
            with self.subTest(phase=phase):
                with self.assertRaisesRegex(Exception, "PRODUCT_NATIVE_LITELLM_REFUSED"):
                    await invoke(handler, _scope(), lambda: None, collect)
                self.assertEqual(len(sent), 0 if phase == "no-transport" else 1)

    async def test_wrong_call_type_override_and_second_send_refuse(self):
        module = SimpleNamespace(callbacks=[])
        async def native(_scope, _receive, _send):
            hook = module.callbacks[0]
            for kwargs, call_type in (({}, "completion"), ({"client": object()}, "anthropic_messages")):
                with self.assertRaisesRegex(Exception, "PRODUCT_NATIVE_LITELLM_REFUSED"):
                    await hook.async_pre_call_deployment_hook(kwargs, call_type)
            await hook.async_pre_call_deployment_hook({}, "anthropic_messages")
            with self.assertRaisesRegex(Exception, "PRODUCT_NATIVE_LITELLM_REFUSED"):
                await hook.async_pre_call_deployment_hook({}, "anthropic_messages")

        invoke = create_product_litellm_invoker(
            native_app=native, litellm_module=module, callback_base=_CustomLogger)
        await invoke(_Handler(), _scope(), lambda: None, _send)

    async def test_concurrent_requests_keep_handlers_separate(self):
        module = SimpleNamespace(callbacks=[])
        arrived = 0
        ready = asyncio.Event()
        seen = []

        async def native(scope, _receive, send):
            nonlocal arrived
            arrived += 1
            if arrived == 2:
                ready.set()
            await ready.wait()
            result = await module.callbacks[0].async_pre_call_deployment_hook(
                {}, "anthropic_messages")
            seen.append((scope, result["client"]))
            result["client"]._product_native_dispatch_evidence.mark_entered()
            await send({"type": "http.response.start", "status": 200, "headers": []})

        invoke = create_product_litellm_invoker(
            native_app=native, litellm_module=module, callback_base=_CustomLogger)
        a, b = _scope(), _scope()
        left, right = _Handler(), _Handler()
        await asyncio.gather(
            invoke(left, a, lambda: None, _send),
            invoke(right, b, lambda: None, _send))
        self.assertEqual({id(scope): handler for scope, handler in seen},
                         {id(a): left, id(b): right})

    async def test_copied_child_context_is_revoked_after_request(self):
        module = SimpleNamespace(callbacks=[])
        release = asyncio.Event()
        child = None

        async def native(_scope, _receive, _send):
            nonlocal child
            async def later():
                await release.wait()
                return await module.callbacks[0].async_pre_call_deployment_hook(
                    {}, "anthropic_messages")
            child = asyncio.create_task(later())

        invoke = create_product_litellm_invoker(
            native_app=native, litellm_module=module, callback_base=_CustomLogger)
        await invoke(_Handler(), _scope(), lambda: None, _send)
        release.set()
        with self.assertRaisesRegex(Exception, "PRODUCT_NATIVE_LITELLM_REFUSED"):
            await child


if __name__ == "__main__":
    unittest.main()
