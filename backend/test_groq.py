import asyncio
import os
import json
import logging
from openai import AsyncOpenAI

async def test_groq():
    try:
        client = AsyncOpenAI(
            api_key=os.getenv("GROQ_API_KEY", ""),
            base_url="https://api.groq.com/openai/v1"
        )
        
        prompt = """
        Extract the following fields from the text below to populate a project intake form.
        Return the result as a valid JSON object ONLY, with these exact keys:
        - "projectName": string
        - "problemStatement": string
        - "desiredOutcome": string
        - "whatDoYouDoToday": string (optional, up to 1024 chars)
        - "whatTranspiresIfWeDoNothing": string (optional, up to 1024 chars)
        - "notesComments": string (optional)
        
        If a field is not found in the text, leave it as an empty string. Do not include markdown formatting like ```json in the output, just raw JSON.
        
        Text:
        PROJECT PROPOSAL DOCUMENT
        Project Name: Cloud Migration and Infrastructure Modernization
        """
        
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        print("SUCCESS:", response.choices[0].message.content)
    except Exception as e:
        print("ERROR:", str(e))

if __name__ == "__main__":
    asyncio.run(test_groq())
