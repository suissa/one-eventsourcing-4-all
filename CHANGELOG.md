# Changelog

Todas as mudanças notáveis deste projeto serão documentadas aqui.

---

## [Release] v0.1.0

### What's Changed

- ✨ Implementação inicial do `EventSourcingFactory` via ES6 Proxy
- ✨ Interface `DomainEvent` com type, timestamp, payload e metadata
- ✨ Tipo utilitário `EventSourced<T>` com `$on()` e `$dispose()`
- ✨ Suporte a interceptação de métodos síncronos e assíncronos (Promise)
- ✨ Health Check automático em background com intervalo configurável
- ✨ Callback global `onEvent` nas opções de configuração
- 📝 README.md completo com arquitetura, API reference e exemplos avançados
- 🔧 `.gitignore` configurado
