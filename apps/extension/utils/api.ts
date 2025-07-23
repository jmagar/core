import { Storage } from "@plasmohq/storage"

import { isExtensionContextValid, withValidContext } from "./context"

const storage = new Storage()
const API_BASE_URL = "https://core.heysol.ai/api/v1"

export interface CoreEpisode {
  episodeBody: string
  referenceTime: Date
  source: string
}

export interface CoreSearchQuery {
  query: string
}

export interface CoreSearchResponse {
  facts: string[]
  episodes: CoreEpisode[]
}

async function getApiKey(): Promise<string | null> {
  if (!isExtensionContextValid()) {
    console.log("Extension context invalid, cannot get API key")
    return null
  }

  return withValidContext(async () => {
    return await storage.get("core_api_key")
  }, null)
}

export async function addEpisode(episodeBody: string): Promise<boolean> {
  const apiKey = await getApiKey()
  if (!apiKey) {
    console.error("No API key found")
    return false
  }

  try {
    const response = await fetch(`${API_BASE_URL}/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        episodeBody,
        referenceTime: new Date(),
        source: "Core extension"
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return true
  } catch (error) {
    console.error("Failed to add episode:", error)
    return false
  }
}

export async function searchFacts(
  query: string
): Promise<CoreSearchResponse | null> {
  const apiKey = await getApiKey()
  if (!apiKey) {
    console.error("No API key found")
    return null
  }

  try {
    const response = await fetch(`${API_BASE_URL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ query })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const responseJson = await response.json()

    return responseJson
  } catch (error) {
    console.error("Failed to search facts:", error)
    return null
  }
}
