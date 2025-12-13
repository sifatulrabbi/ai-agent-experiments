from dotenv import load_dotenv

load_dotenv()

import os
import asyncio
from typing import Literal
from deepagents import create_deep_agent
from langchain_openai import ChatOpenAI
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from langgraph.store.postgres.aio import AsyncPostgresStore
from tavily import TavilyClient


model = ChatOpenAI(
    model="gpt-5.2",
    reasoning={
        "effort": "low",
        "summary": "auto",
    },
    use_responses_api=True,
)
tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))


def internet_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "general",
    include_raw_content: bool = False,
):
    """Run a web search"""
    return tavily_client.search(
        query,
        max_results=max_results,
        include_raw_content=include_raw_content,
        topic=topic,
    )


def make_backend(runtime):
    return CompositeBackend(
        default=StateBackend(runtime),  # Ephemeral storage
        routes={
            "/memories/": StoreBackend(runtime)  # Persistent storage
        },
    )


async def main():
    async with AsyncPostgresStore.from_conn_string(os.environ["DATABASE_URL"]) as store:
        await store.setup()

        agent = create_deep_agent(
            model=model,
            store=store,
            backend=lambda rt: CompositeBackend(
                default=StateBackend(rt),
                routes={"/memories/": StoreBackend(rt)},
            ),
            system_prompt="""
You are a generic terminal agent. Your primary goal is to assist the user in their productivity tasks.

Your persistent memory structure:
- /memories/preferences.txt: User preferences and settings
- /memories/context/: Long-term context about the user
- /memories/knowledge/: Facts and information learned over time
""".strip(),
            tools=[internet_search],
        )

        while True:
            user_input = input("USER: ")
            result = await agent.ainvoke(
                {
                    "messages": [{"role": "user", "content": user_input}],
                }
            )
            print(result.get("messages", [])[-1].content)


if __name__ == "__main__":
    asyncio.run(main())
