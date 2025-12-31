import express from "express";
import cors from "cors";
import Stripe from "stripe";

const app = express();
app.use(cors());
app.use(express.json());

/* ======================
   CONFIG STRIPE
====================== */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* ======================
   BANCO SIMPLES (MEMÓRIA)
   depois pode trocar por banco real
====================== */
const users = {};

/* ======================
   LOGIN POR EMAIL
====================== */
app.post("/login", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email obrigatório" });

  if (!users[email]) {
    users[email] = {
      plan: "free",
      freeAnalyses: 1
    };
  }

  res.json(users[email]);
});

/* ======================
   ANALISAR TEXTO
====================== */
app.post("/analyze", (req, res) => {
  const { email, text } = req.body;
  const user = users[email];

  if (!user) return res.status(401).json({ error: "Faça login" });

  if (user.plan === "free") {
    if (user.freeAnalyses <= 0) {
      return res.status(403).json({ error: "Limite gratuito atingido" });
    }
    user.freeAnalyses--;
  }

  res.json({
    score: Math.floor(Math.random() * 3) + 6,
    message: "Texto analisado com sucesso"
  });
});

/* ======================
   STRIPE - PAGAMENTO
====================== */
app.post("/create-checkout", async (req, res) => {
  const { priceId, email } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: "https://seusite.com/sucesso",
      cancel_url: "https://seusite.com/cancelado"
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================
   WEBHOOK (ATIVAR PRO)
====================== */
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === "checkout.session.completed") {
      const email = event.data.object.customer_email;
      if (users[email]) users[email].plan = "pro";
    }

    res.json({ received: true });
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

/* ======================
   START SERVER
====================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
