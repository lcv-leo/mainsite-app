# 🔧 PADRÕES CORRIGIDOS - IMPLEMENTAÇÃO DE COMPLIANCE

**Data:** 2026-03-24  
**Escopo:** mainsite-worker/src/index.js  
**Prioridade:** 5 CRÍTICOS + 7 ALTOS

---

## PARTE 1: CRÍTICOS (Implementar Imediatamente)

### [CRÍTICO #1] Mercado Pago Webhook HMAC-SHA256 Signature Validation

**Arquivo Atual:** mainsite-worker/src/index.js  
**Linhas Afetadas:** 1707-1798 (POST /api/webhooks/mercadopago)  
**Problema:** Nenhuma validação criptográfica, apenas validação de query params

**❌ Código Atual (Vulnerável):**
```javascript
// Linha 1707
app.post("/api/webhooks/mercadopago", async (c) => {
  const body = await c.req.json();
  const topic = c.req.query("topic");
  const id = c.req.query("id");
  
  if (!topic || !id) {
    return c.json({ received: true }); // Aceita sem validação!
  }
  // ... resto do código
});
```

**✅ Código Corrigido:**
```javascript
import crypto from "crypto";

// Helper function (exportar para reutilização)
const validateMercadoPagoWebhook = (body, signature, timestamp, secret) => {
  if (!signature || !timestamp) return false;
  
  // Formato: v1=hash1,v1=hash2 (múltiplas versões)
  const id = body.data?.id || body.id;
  const requestId = body.request_id || "unknown";
  
  // String a hashear por Mercado Pago: id;request-id;timestamp
  const stringToHash = `id=${id};request-id=${requestId};timestamp=${timestamp}`;
  
  // Iterar por todos os sig parts (pode haver múltiplos)
  const parts = signature.split(",");
  for (const part of parts) {
    const [version, hash] = part.trim().split("=");
    
    if (version === "v1") {
      // v1 usa HMAC-SHA256 com shared secret (webhook secret)
      const computed = crypto
        .createHmac("sha256", secret)
        .update(stringToHash)
        .digest("hex");
      
      if (hash === computed) {
        return true;  // ✅ Signature válido
      }
    }
  }
  return false;  // ❌ Nenhum signature válido
};

// [APLICAR AO ENDPOINT] mainsite-worker/src/index.js linha 1707
app.post("/api/webhooks/mercadopago", async (c) => {
  const signature = c.req.header("x-signature");
  const timestamp = c.req.header("x-timestamp");
  
  const body = await c.req.json();
  
  // 1️⃣ VALIDAR ASSINATURA (NOVO)
  if (!validateMercadoPagoWebhook(
    body,
    signature,
    timestamp,
    c.env.MERCADO_PAGO_WEBHOOK_SECRET  // Novo env var
  )) {
    // Log em structured format
    await logStructured(c.env.DB, {
      level: "security",
      message: "Webhook signature validation failed",
      endpoint: "mercadopago",
      ip: c.req.header("cf-connecting-ip"),
      timestamp: new Date().toISOString()
    });
    
    return c.json({ error: "Invalid signature" }, 401);
  }
  
  // 2️⃣ VALIDAR TIMESTAMP (NOVO) - máximo 5 minutos
  const webhookAge = Date.now() - parseInt(timestamp);
  if (webhookAge > 300_000) {  // 5 minutos
    await logStructured(c.env.DB, {
      level: "warning",
      message: "Webhook too old (>5 min)",
      age_seconds: (webhookAge / 1000).toFixed(2),
      endpoint: "mercadopago"
    });
    
    return c.json({ error: "Request too old" }, 400);
  }
  
  // 3️⃣ VALIDAR CONTEÚDO MÍNIMO
  const topic = body.topic;  // Já em body, não em query
  const id = body.data?.id;
  
  if (!topic || !id) {
    await logStructured(c.env.DB, {
      level: "warning",
      message: "Webhook missing required fields",
      endpoint: "mercadopago"
    });
    
    return c.json({ received: true }, 202);  // Aceitar mas não processar
  }
  
  // 4️⃣ CONFIRMAR COM API (official best practice)
  try {
    const eventData = await paymentApi.get({ id });
    
    if (!eventData || eventData.status === 404) {
      return c.json({ received: true }, 202);  // Evento não encontrado
    }
    
    // 5️⃣ PROCESSAR ATOMICAMENTE
    await processPaymentEvent(c.env.DB, eventData);
    
    return c.json({ received: true }, 200);
    
  } catch (error) {
    await logStructured(c.env.DB, {
      level: "error",
      message: "Webhook processing failed",
      error: error.message,
      endpoint: "mercadopago",
      id: id
    });
    
    // Retornar 202 para Mercado Pago retry
    return c.json({ received: true }, 202);
  }
});
```

**⚙️ Configuração Necessária (env vars):**
```
MERCADO_PAGO_WEBHOOK_SECRET=whsec_abc123...  # Obter em Mercado Pago console
```

**Teste:**
```bash
# Teste com signature inválida
curl -X POST http://localhost:8787/api/webhooks/mercadopago \
  -H "x-signature: v1=invalidsignature" \
  -H "x-timestamp: $(date +%s)000" \
  -d '{"id":"123"}'
# Esperado: 401 Invalid signature

# Teste com signature válido (gerar via HMAC)
# ... (manual testing)
```

---

### [CRÍTICO #2] Adicionar Bearer Token a POST /api/sumup/checkout

**Arquivo Atual:** mainsite-worker/src/index.js  
**Linhas Afetadas:** 1029-1060 (POST /api/sumup/checkout)  
**Problema:** Zero autenticação, qualquer um pode criar checkouts ilimitadamente

**❌ Código Atual:**
```javascript
app.post("/api/sumup/checkout", async (c) => {
  const body = await c.req.json();
  // Direto cria checkout sem verificar quem está chamando!
  const response = await sumupClient.checkouts.create({...});
});
```

**✅ Código Corrigido:**
```javascript
// Helper: Middleware de Bearer Token
const validateBearerToken = (req, expectedToken) => {
  const authHeader = req.header("Authorization");
  if (!authHeader) return false;
  
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return false;
  
  // Comparação segura (timing-safe)
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(expectedToken)
  );
};

// [APLICAR] mainsite-worker/src/index.js linha 1029
app.post("/api/sumup/checkout", async (c) => {
  // 1️⃣ VALIDAR BEARER TOKEN (NOVO)
  if (!validateBearerToken(c.req, c.env.SUMUP_API_TOKEN)) {
    await logStructured(c.env.DB, {
      level: "security",
      message: "Unauthorized checkout creation attempt",
      endpoint: "sumup/checkout",
      ip: c.req.header("cf-connecting-ip"),
      has_auth: !!c.req.header("Authorization")
    });
    
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  try {
    const body = await c.req.json();
    
    // 2️⃣ VALIDAR PAYLOAD
    if (!body.amount || !body.description) {
      return c.json({
        error: "Missing required fields: amount, description"
      }, 400);
    }
    
    if (body.amount <= 0 || body.amount > 1_000_000) {
      return c.json({
        error: "Amount must be between 0.01 and 1,000,000"
      }, 400);
    }
    
    // 3️⃣ CRIAR CHECKOUT COM TIMEOUT CUSTOMIZADO (novo)
    const checkout = await sumupClient.checkouts.create(
      {
        amount: body.amount,
        currency: "BRL",
        description: body.description,
        payment_type: "CARD",
        redirect_url: body.redirect_url || "https://mainsite.com",
        return_url: body.return_url || "https://mainsite.com"
      },
      {
        timeout: 10_000,  // 10 segundos (checkout pode ser lento)
        maxRetries: 2
      }
    );
    
    // 4️⃣ PERSISTIR COM STRUCTURED LOG
    await logStructured(c.env.DB, {
      level: "info",
      message: "Checkout created successfully",
      endpoint: "sumup/checkout",
      checkout_id: checkout.id,
      amount: body.amount,
      requester: "authorized_client"
    });
    
    return c.json({
      id: checkout.id,
      amount: checkout.amount,
      description: checkout.description,
      checkout_url: checkout.checkout_url
    }, 201);
    
  } catch (error) {
    await logStructured(c.env.DB, {
      level: "error",
      message: "Checkout creation failed",
      endpoint: "sumup/checkout",
      error: error.message,
      error_type: error.constructor.name
    });
    
    return c.json({
      error: "Failed to create checkout",
      id: error.id || "unknown"
    }, 500);
  }
});
```

**⚙️ Configuração:**
```
SUMUP_API_TOKEN=sup_api_token_xxx...  # Gerar token no SumUp dashboard
```

---

### [CRÍTICO #3] Adicionar Bearer Token a POST /api/sumup/checkout/:id/pay

**Arquivo Atual:** mainsite-worker/src/index.js  
**Linhas Afetadas:** 1063-1141  
**Problema:** Aceita card details de cliente não autenticado, altíssimo risco de fraude

**❌ Código Atual:**
```javascript
app.post("/api/sumup/checkout/:id/pay", async (c) => {
  const body = await c.req.json();
  // Client envia card details direto e processo paga!
  const result = await sumupClient.checkout.pay({
    card: body.card_number,  // ❌ NUNCA aceitar número de cartão
    cvv: body.cvv             // ❌ NUNCA aceitar CVV
  });
});
```

**✅ Código Corrigido:**
```javascript
app.post("/api/sumup/checkout/:id/pay", async (c) => {
  // 1️⃣ VALIDAR BEARER TOKEN (NOVO)
  if (!validateBearerToken(c.req, c.env.SUMUP_API_TOKEN)) {
    await logStructured(c.env.DB, {
      level: "security",
      message: "Unauthorized payment attempt",
      endpoint: "sumup/checkout/:id/pay",
      ip: c.req.header("cf-connecting-ip"),
      checkout_id: c.req.param("id")
    });
    
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  try {
    const checkoutId = c.req.param("id");
    const body = await c.req.json();
    
    // 2️⃣ VALIDAR CHECKOUT AINDA NÃO FOI PAGO
    const existingCheckout = await sumupClient.checkouts.get(checkoutId, {
      timeout: 5_000
    });
    
    if (existingCheckout.status === "COMPLETED") {
      return c.json({
        error: "Checkout already paid"
      }, 400);
    }
    
    // 3️⃣ ACEITAR APENAS TOKEN DE CARTÃO (not raw card details)
    // **IMPORTANTE:** Client deve tokenizar card via Sumup.js SDK
    // Essa API nunca deve receber número de cartão!
    if (!body.token) {
      return c.json({
        error: "Missing card token (use SumUp.js to tokenize)"
      }, 400);
    }
    
    // 4️⃣ PROCESSAR PAGAMENTO
    const payment = await sumupClient.checkouts.pay(
      {
        checkout_id: checkoutId,
        token: body.token,  // ✅ Token, não número de cartão
        idempotency_key: body.idempotency_key || generateUUID()
      },
      {
        timeout: 15_000,  // Pagamento pode ser lento
        maxRetries: 1
      }
    );
    
    // 5️⃣ PERSISTIR RESULTADO
    await c.env.DB.prepare(`
      INSERT INTO financial_logs (
        transaction_id, gateway, status, amount, raw_payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      payment.transaction_id,
      "sumup",
      payment.status,
      existingCheckout.amount,
      JSON.stringify(payment),
      new Date().toISOString()
    ).run();
    
    await logStructured(c.env.DB, {
      level: "info",
      message: "Payment processed successfully",
      endpoint: "sumup/checkout/:id/pay",
      checkout_id: checkoutId,
      transaction_id: payment.transaction_id,
      status: payment.status,
      amount: existingCheckout.amount
    });
    
    return c.json({
      status: payment.status,
      transaction_id: payment.transaction_id,
      amount: existingCheckout.amount
    }, 200);
    
  } catch (error) {
    await logStructured(c.env.DB, {
      level: "error",
      message: "Payment failed",
      endpoint: "sumup/checkout/:id/pay",
      error: error.message,
      checkout_id: c.req.param("id")
    });
    
    return c.json({
      error: "Payment failed",
      id: error.id || "unknown"
    }, 500);
  }
});
```

**⚠️ Client-Side Requirement (Frontend):**
```javascript
// Isso DEVE ser feito no frontend, NUNCA no backend:
const { token } = await SumUp.createCardToken({
  number: userCardNumber,
  cvv: userCvv,
  name: userName
});

// Enviar apenas token para backend
fetch('/api/sumup/checkout/' + checkoutId + '/pay', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + apiToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ token })  // ✅ Token, não card details
});
```

---

### [CRÍTICO #4] Adicionar Bearer Token a POST /api/mp-payment

**Arquivo Atual:** mainsite-worker/src/index.js  
**Linhas Afetadas:** 1591-1651  
**Problema:** Sem validação de bearer token, client não autenticado pode criar pagamentos

**❌ Código Atual:**
```javascript
app.post("/api/mp-payment", async (c) => {
  const body = await c.req.json();
  // Direto cria pagamento sem verificar autenticação!
  const payment = await paymentApi.create({ body });
});
```

**✅ Código Corrigido:**
```javascript
app.post("/api/mp-payment", async (c) => {
  // 1️⃣ VALIDAR BEARER TOKEN (NOVO)
  if (!validateBearerToken(c.req, c.env.MERCADO_PAGO_API_TOKEN)) {
    await logStructured(c.env.DB, {
      level: "security",
      message: "Unauthorized MP payment creation attempt",
      endpoint: "mp-payment",
      ip: c.req.header("cf-connecting-ip"),
      has_auth: !!c.req.header("Authorization")
    });
    
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  try {
    const body = await c.req.json();
    
    // 2️⃣ VALIDAR PAYLOAD MÍNIMO
    if (!body.transaction_amount || !body.description || !body.payment_method_id) {
      return c.json({
        error: "Missing fields: transaction_amount, description, payment_method_id"
      }, 400);
    }
    
    // 3️⃣ VALIDAR AMOUNT
    const amount = parseFloat(body.transaction_amount);
    if (amount <= 0 || amount > 100_000) {
      return c.json({
        error: "Amount must be between 0.01 and 100,000 BRL"
      }, 400);
    }
    
    // 4️⃣ GERAR IDEMPOTENCY KEY (NOVO - crítico!)
    import { v4 as uuidv4 } from 'uuid';
    const idempotencyKey = body.idempotency_key || uuidv4();
    
    // 5️⃣ CRIAR PAGAMENTO COM SDK E IDEMPOTENCY
    const paymentData = {
      transaction_amount: amount,
      description: body.description,
      payment_method_id: body.payment_method_id,
      payer: {
        email: body.payer?.email,
        identification: {
          type: body.payer?.id_type || "CPF",
          number: body.payer?.id_number
        }
      },
      statement_descriptor: "MAINSITE"
    };
    
    const payment = await paymentApi.create(
      { body: paymentData },
      {
        idempotencyKey: idempotencyKey,  // ✅ NOVO!
        timeout: 10_000
      }
    );
    
    // 6️⃣ PERSISTIR
    await c.env.DB.prepare(`
      INSERT INTO financial_logs (
        transaction_id,
        gateway,
        status,
        amount,
        payer_email,
        raw_payload,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      payment.id,
      "mercado_pago",
      payment.status,
      amount,
      body.payer?.email,
      JSON.stringify(payment),
      new Date().toISOString()
    ).run();
    
    await logStructured(c.env.DB, {
      level: "info",
      message: "MP Payment created successfully",
      endpoint: "mp-payment",
      payment_id: payment.id,
      status: payment.status,
      amount: amount,
      idempotency_key: idempotencyKey
    });
    
    return c.json({
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      amount: payment.transaction_amount,
      created_at: payment.date_created
    }, 201);
    
  } catch (error) {
    await logStructured(c.env.DB, {
      level: "error",
      message: "MP Payment creation failed",
      endpoint: "mp-payment",
      error: error.message,
      error_type: error.constructor.name
    });
    
    return c.json({
      error: "Payment creation failed",
      id: error.id || "unknown"
    }, 500);
  }
});
```

**⚙️ Configuração:**
```
MERCADO_PAGO_API_TOKEN=bearer_token_xxx...
```

---

## PARTE 2: ALTOS (Implementar em 30 dias)

### [ALTO #5] Adicionar Idempotency Keys a Mercado Pago Payment.search()

**Arquivo Atual:** mainsite-worker/src/index.js  
**Linha:** ~1537 (GET /api/mp/transaction/:id)

**Problema:** Sem idempotency, múltiplas calls idênticas podem retornar inconsistências  
**Risco:** BaixoMedian (search é idempotente por natureza, mas melhor ter)

**Código Corrigido:**
```javascript
app.get("/api/mp/transaction/:id", async (c) => {
  const transactionId = c.req.param("id");
  
  if (!transactionId) {
    return c.json({ error: "Missing transaction ID" }, 400);
  }
  
  try {
    // GET é intrinsecamente idempotente, mas podemos adicionar cache
    const cacheKey = `mp_tx_${transactionId}`;
    const cached = await c.env.DB.prepare(`
      SELECT data, created_at FROM mp_cache 
      WHERE key = ? AND created_at > datetime('now', '-5 minutes')
    `).bind(cacheKey).first();
    
    if (cached) {
      return c.json(JSON.parse(cached.data), 200);
    }
    
    // Buscar do Mercado Pago
    const payment = await paymentApi.get(
      { id: transactionId },
      { 
        timeout: 8_000,
        idempotencyKey: `get_${transactionId}`  // Cache-like behavior
      }
    );
    
    // Armazenar em cache
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO mp_cache (key, data, created_at)
      VALUES (?, ?, datetime('now'))
    `).bind(cacheKey, JSON.stringify(payment)).run();
    
    return c.json(payment, 200);
    
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});
```

---

### [ALTO #6] SumUp Per-Request Options com Timeout/Retry

**Arquivo Atual:** mainsite-worker/src/index.js  
**Linhas Afetadas:** 1040-1200 (todas as calls ao SumUp client)

**Problema:** Timeout global 5s pode ser insuficiente para algumas calls  
**Solução:** Customizar per-call conforme tipo de operação

```javascript
// ANTES (timeout global)
const checkouts = await sumupClient.checkouts.list();

// DEPOIS (timeout customizado por tipo)
const checkouts = await sumupClient.checkouts.list(undefined, {
  timeout: 8_000,    // Mais tempo para list (podem ser muitos registros)
  maxRetries: 2,     // Mais retries para operação não-crítica
});

const merchants = await sumupClient.merchants.get(code, {
  timeout: 5_000,    // Menos tempo (call rápido)
  maxRetries: 1
});

const transactions = await sumupClient.transactions.list(undefined, {
  timeout: 12_000,   // Lista pode ser lenta (muitos registros)
  maxRetries: 3      // Mais retries
});
```

**Aplicar a:**
```
- sumup/checkouts (list): timeout 8000, maxRetries 2
- sumup/transactions (list): timeout 12000, maxRetries 3
- sumup/merchants: timeout 5000, maxRetries 1
- sumup/payouts (list): timeout 10000, maxRetries 2
```

---

### [ALTO #7] Mercado Pago per-request options (timeout customizado)

**Arquivo Atual:** mainsite-worker/src/index.js  
**Linhas Afetadas:** 1400-1700 (todas as calls ao paymentApi)

```javascript
// Payment methods (pode listar muitos)
const methods = await paymentMethodApi.list(undefined, {
  timeout: 10_000
});

// Payment search (pode retornar muitos resultados)
const payments = await paymentApi.search(
  { filters },
  { timeout: 12_000 }
);

// Single transaction get (rápido)
const payment = await paymentApi.get(
  { id: paymentId },
  { timeout: 5_000 }
);

// Refund (operação crítica, mais tempo)
const refund = await refundApi.create(
  { body: { payment_id, amount } },
  { timeout: 15_000, idempotencyKey: uuid }
);
```

---

### [ALTO #8] Usar SDK PaymentRefund.create() em vez de HTTP Direto

**Arquivo Atual:** mainsite-worker/src/index.js  
**Linha:** ~2068 (POST /api/sumup-payment/:id/refund)

**❌ Atual (HTTP direto):**
```javascript
const response = await fetch('https://api.sumup.com/refunds', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SUMUP_SECRET}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ ... })
});
```

**✅ Corrigido (usar SDK):**
```javascript
app.post("/api/sumup-payment/:id/refund", async (c) => {
  // Validar Bearer
  if (!validateBearerToken(c.req, c.env.SUMUP_API_TOKEN)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  try {
    const transactionId = c.req.param("id");
    const body = await c.req.json();
    
    // Buscar transação original
    const originalTx = await sumupClient.transactions.get(transactionId, {
      timeout: 5_000
    });
    
    if (!originalTx || originalTx.status !== "COMPLETED") {
      return c.json({
        error: "Transaction not found or not completed"
      }, 400);
    }
    
    // Validar amount
    const refundAmount = Math.min(
      body.amount || originalTx.amount,
      originalTx.amount  // Nunca pode ser > original
    );
    
    // Usar SDK para reembolso (presumindo que suporte refund)
    // Verificar se SumUp SDK tem refund nativo ou se precisa HTTP
    const refund = await sumupClient.refunds?.create?.(
      {
        transaction_id: transactionId,
        amount: refundAmount,
        reason: body.reason || "Customer request"
      },
      { timeout: 10_000 }
    ) || await httpRefund(transactionId, refundAmount);
    
    // Persistir
    await c.env.DB.prepare(`
      INSERT INTO financial_logs (
        transaction_id, gateway, status, amount, raw_payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      refund.id,
      "sumup_refund",
      refund.status,
      refundAmount,
      JSON.stringify(refund),
      new Date().toISOString()
    ).run();
    
    return c.json({
      refund_id: refund.id,
      status: refund.status,
      amount: refundAmount
    }, 200);
    
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});
```

---

### [ALTO #9] Implementar Cache para Payment Methods

**Arquivo Atual:** mainsite-worker/src/index.js  
**Linha:** ~1434 (GET /api/mp/payment-methods)

**❌ Atual (sem cache, chama API sempre):**
```javascript
app.get("/api/mp/payment-methods", async (c) => {
  const auth = c.req.header("Authorization");
  
  // Chama API sempre
  const methods = await paymentMethodApi.list();
  
  return c.json(methods, 200);
});
```

**✅ Corrigido (com cache TTL 1 hora):**
```javascript
app.get("/api/mp/payment-methods", async (c) => {
  // Validar Bearer
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  try {
    const cacheKey = "mp_payment_methods";
    const cacheTTL = 3600000;  // 1 hora em ms
    
    // 1️⃣ VERIFICAR CACHE
    const cached = await c.env.DB.prepare(`
      SELECT data, created_at FROM mp_cache
      WHERE key = ?
    `).bind(cacheKey).first();
    
    const now = Date.now();
    if (cached && (now - new Date(cached.created_at).getTime()) < cacheTTL) {
      await logStructured(c.env.DB, {
        level: "info",
        message: "Payment methods from cache",
        endpoint: "mp/payment-methods",
        cache_age_ms: now - new Date(cached.created_at).getTime()
      });
      
      return c.json(JSON.parse(cached.data), 200);
    }
    
    // 2️⃣ NÃO HÁ CACHE, BUSCAR DA API
    const methods = await paymentMethodApi.list(undefined, {
      timeout: 10_000
    });
    
    // 3️⃣ ARMAZENAR EM CACHE
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO mp_cache (key, data, created_at)
      VALUES (?, ?, ?)
    `).bind(
      cacheKey,
      JSON.stringify(methods),
      new Date().toISOString()
    ).run();
    
    await logStructured(c.env.DB, {
      level: "info",
      message: "Payment methods fetched and cached",
      endpoint: "mp/payment-methods",
      method_count: methods.length || 0
    });
    
    return c.json(methods, 200);
    
  } catch (error) {
    await logStructured(c.env.DB, {
      level: "error",
      message: "Failed to fetch payment methods",
      endpoint: "mp/payment-methods",
      error: error.message
    });
    
    return c.json({ error: error.message }, 500);
  }
});
```

**Schema D1 Necessário:**
```sql
CREATE TABLE IF NOT EXISTS mp_cache (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mp_cache_created_at ON mp_cache(created_at);
```

---

### [ALTO #10] Structured Logging com Correlation ID

Já foi implementado na fase Gemini v1beta, confirmar presente em:
- `env/STRUCTURED_LOGGING_ENABLED`
- Cada endpoint com `await logStructured(c.env.DB, {...})`

---

## PARTE 3: BAIXOS (Médio Prazo)

### [MÉDIO #11] Validação de Amount em Refunds

**Linhas Afetadas:** 2068 (refund endpoint)

Já coberto em [ALTO #8] — refund amount é limitado a transaction amount.

---

### [MÉDIO #12] Webhook Timestamp Validation

Já coberto em [CRÍTICO #1] — validar idade < 5 minutos.

---

## ROADMAP DE IMPLEMENTAÇÃO

| Prioridade | ID | Feature | Estimativa | Status |
|------------|----|------------|-----------|--------|
| 🔴 | #1 | MP Webhook HMAC | 2h | **Próximo** |
| 🔴 | #2 | SumUp Checkout Auth | 1h | **Próximo** |
| 🔴 | #3 | SumUp Pay Auth | 1h | **Próximo** |
| 🔴 | #4 | MP Payment Auth | 1h | **Próximo** |
| 🟡 | #5 | Idempotency Keys | 2h | Após críticos |
| 🟡 | #6 | SumUp Per-Request Options | 1.5h | Após críticos |
| 🟡 | #7 | MP Per-Request Options | 1.5h | Após críticos |
| 🟡 | #8 | SDK Refund | 1.5h | Após críticos |
| 🟡 | #9 | Payment Methods Cache | 2h | Após críticos |
| 🔵 | #10-12 | Logging/Validation | 1h | Verificar |

**Tempo Total:** ~15 horas  
**Fase Crítica:** 5 horas (parallelizável)  
**Target:** Completar críticos + altos em 5 dias úteis

---

**Próximo Passo:** Iniciar implementação de [CRÍTICO #1] mainsite-worker/src/index.js linha 1707
