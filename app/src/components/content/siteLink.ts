import { siteContent } from '@/contents'

type SiteLinkKey = keyof typeof siteContent.links

export function siteLink(key: string) {
  if (!(key in siteContent.links)) {
    throw new Error(`Unknown site link: ${key}`)
  }

  return siteContent.links[key as SiteLinkKey]
}
