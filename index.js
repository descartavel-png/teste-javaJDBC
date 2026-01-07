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
      model: "deepseek-ai/deepseek-r1-0528",
      messages: [
        { role: "system", content: `Contexto anterior: ${summary}` },
        ...lastMessages
      ],
      max_tokens: 16384, 
      temperature: 0.6,
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

    // --- INÍCIO DA LIMPEZA DO <THINK> ---
    let responseData = response.data;

    if (responseData.choices && responseData.choices[0].message.content) {
      let textoOriginal = response.data.choices[0].message.content;

      // Remove o bloco <think>...</think> completo
      // O regex [\s\S]*? garante que pegue quebras de linha e seja "lazy" (pare no primeiro </think>)
      let textoLimpo = textoOriginal.replace(/<think>[\s\S]*?<\/think>/g, "");

      // Caso o modelo tenha sido cortado antes de fechar a tag </think>
      textoLimpo = textoLimpo.replace(/<think>[\s\S]*/g, "");

      // Remove espaços vazios extras que sobram no início ou fim
      responseData.choices[0].message.content = textoLimpo.trim();
    }
    // --- FIM DA LIMPEZA ---

    res.json(responseData);

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
