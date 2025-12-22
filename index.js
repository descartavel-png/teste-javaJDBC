import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" })); // aumenta limite de payload

// Função simples de resumo de mensagens antigas
async function summarizeMessages(oldMessages) {
  const text = oldMessages.map(msg => `${msg.role}: ${msg.content}`).join("\n");
  // Se for muito grande, cortar mantendo o final
  return text.length > 2000 ? text.slice(-2000) + "..." : text;
}

app.post("/v1/chat/completions", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages precisa ser um array" });
    }

    const lastMessages = messages.slice(-50);
    const oldMessages = messages.slice(0, -50);

    const summary = await summarizeMessages(oldMessages);

    const payload = {
  model: "deepseek-ai/deepseek-r1", // Verifique se este ID exato está no seu catálogo
  messages: [
    { role: "system", content: `Contexto anterior: ${summary}` },
    ...lastMessages
  ],
  // Em vez de tirar, coloque um valor alto
  max_tokens: 16384, 
  temperature: 0.6, // O R1 performa melhor entre 0.5 e 0.7
  top_p: 0.95
};
    const response = await axios.post(
      process.env.NVIDIA_API_URL,
      payload,
      {
        headers: {
          "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json(response.data);

  } catch (err) {
    console.error("ERRO DA NVIDIA:", err.response?.data || err.message);
    res.status(500).json({ 
      error: "Erro na NVIDIA", 
      detalhes: err.response?.data?.body?.detail || err.message 
    });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`API rodando na porta ${process.env.PORT || 3000}`);
});
