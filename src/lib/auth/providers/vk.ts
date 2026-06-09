import type { OAuthConfig, OAuthUserConfig } from "@auth/core/providers";

export interface VKProfile {
  user_id: string;
  email?: string;
  first_name: string;
  last_name: string;
  avatar?: string;
}

export default function VK<P extends VKProfile = VKProfile>(
  options: OAuthUserConfig<P>,
): OAuthConfig<P> {
  return {
    id: "vk",
    name: "VK",
    type: "oauth",
    authorization: {
      url: "https://id.vk.com/authorize",
      params: { scope: "email", response_type: "code" },
    },
    token: "https://id.vk.com/oauth2/auth",
    userinfo: "https://id.vk.com/oauth2/user_info",
    profile(profile) {
      return {
        id: profile.user_id,
        name: `${profile.first_name} ${profile.last_name}`,
        email: profile.email ?? null,
        image: profile.avatar ?? null,
      };
    },
    options,
  };
}
