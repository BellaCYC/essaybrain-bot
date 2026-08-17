import os
import sqlite3
import discord
from discord.ext import commands
from google import genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Initialize Gemini AI Client
ai_client = genai.Client(api_key=GEMINI_API_KEY)

# Setup SQLite Database to store logged activities
conn = sqlite3.connect("memory.db")
cursor = conn.cursor()
cursor.execute('''
    CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        content TEXT
    )
''')
conn.commit()

# Setup Discord Bot
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)

# Models verified available on your account
WORKING_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest"
]

# Helper function to send long responses safely
async def send_long_message(ctx, text: str):
    if not text:
        await ctx.send("⚠️ Empty response received from AI.")
        return
    MAX_LENGTH = 1900
    for i in range(0, len(text), MAX_LENGTH):
        await ctx.send(text[i:i + MAX_LENGTH])

@bot.event
async def on_ready():
    print(f"✅ Bot is online as {bot.user.name}!")

# 1. COMMAND: !log <your experience/skill>
@bot.command(name="log")
async def log_activity(ctx, *, entry: str = None):
    if not entry:
        await ctx.send("⚠️ Please provide information to log! Example:\n`!log Taught Python to rural middle school students`")
        return
    
    user_id = str(ctx.author.id)
    cursor.execute("INSERT INTO memories (user_id, content) VALUES (?, ?)", (user_id, entry))
    conn.commit()
    await ctx.send("got it!")

@bot.command(name="menu")
async def show_menu(ctx):
    help_text = (
        "**🤖 Available Bot Commands**\n\n"
        "• `!log <entry>` — Save a background experience or skill to memory.\n"
        "• `!essay <focus>` — Get strategic admissions advice based on your logs.\n"
        "• `!essay paraphrase: <text>` — Get quick, bulleted rephrasing options.\n"
        "• `!essay recap` — Summarize and review your past saved concepts."
    )
    await ctx.send(help_text)

# 2. COMMAND: !essay [direction/focus/paraphrase/recall]
@bot.command(name="essay")
async def brainstorm_essay(ctx, *, direction: str = None):
    user_id = str(ctx.author.id)
    
    # Retrieve logged experiences for this user
    cursor.execute("SELECT content FROM memories WHERE user_id = ?", (user_id,))
    rows = cursor.fetchall()
    
    user_direction = direction if direction else "Highlight my greatest skills and achievements."
    lower_dir = user_direction.lower()

    # --- INTENT ROUTER ---

    # MODE A: Paraphrasing / Rephrasing Request
    if any(trigger in lower_dir for trigger in ["paraphrase", "rephrase", "how could this", "rewrite"]):
        prompt = f"""
SYSTEM INSTRUCTION:
You are a ultra-concise writing assistant. The user wants to rephrase or paraphrase text.
STRICT RULES:
1. Provide ONLY 2 to 3 alternative phrasing options in a bulleted list.
2. Absolutely NO introductory setup, greetings, or conversational filler.
3. Do NOT generate long paragraphs or explanations. Output the rephrased options directly.


USER REQUEST:
"{user_direction}"
"""

    # MODE B: Recall Previous Essay / Past Ideas
    elif any(trigger in lower_dir for trigger in ["previous essay", "past idea", "last draft", "previous idea", "recap"]):
        if not rows:
            await ctx.send("⚠️ No background logs found! Use `!log <your skill/experience>` first.")
            return
        
        logged_context = "\n- ".join([row[0] for row in rows])
        prompt = f"""
SYSTEM INSTRUCTION:
You are a writing partner helping the student recall and review their previously saved essay ideas.

Student's Saved Memory Logs:
- {logged_context}

USER REQUEST:
"{user_direction}"

OUTPUT REQUIREMENT:
1. Summarize their past saved concepts into key themes.
2. Highlight which 2 past ideas have the strongest potential for an essay hook.
3. Keep the response concise, punchy, and structured. Do NOT write full essay drafts.
"""

    # MODE C: Default Socratic / Admissions Strategy Mode
    else:
        if not rows:
            await ctx.send("⚠️ No background logs found! Use `!log <your skill/experience>` first.")
            return

        logged_context = "\n- ".join([row[0] for row in rows])
        prompt = f"""
You are an expert US college admissions consultant and Socratic writing advisor.

Student's Logged Background:
- {logged_context}

Requested Essay Focus/Direction:
"{user_direction}"

Please provide a structured response with:
1. **Core Narrative Angle**: How to frame these experiences effectively.
2. **3 Strategic Key Points**: Specific moments, soft skills, or personal growth to highlight.
3. **Opening Hook Idea**: A compelling opening line or scene starter.

Do NOT write the essay for them—provide high-level strategic points and advice.
"""

    # --- AI GENERATION LOOP ---
    async with ctx.typing():
        response_text = None
        last_error = None

        # Try active models sequentially
        for model_id in WORKING_MODELS:
            try:
                print(f"🤖 Trying model: {model_id}...")
                chat = ai_client.aio.chats.create(model=model_id)
                res = await chat.send_message(prompt)
                if res and res.text:
                    response_text = res.text
                    break
            except Exception as e:
                print(f"⚠️ {model_id} failed: {e}")
                last_error = e
                continue

        if response_text:
            await send_long_message(ctx, response_text)
        else:
            await ctx.send(f"❌ Could not generate response: `{str(last_error)}`")

bot.run(DISCORD_TOKEN)

