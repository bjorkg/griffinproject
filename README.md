# ARToF — The Art of Fashion

ARToF is a fashion illustration and social platform connected to the ARToF staging backend in Supabase.

## Current web app

- Email/password authentication
- Creator profiles
- FOR YOU / FOLLOWING feeds
- Likes, saves and Not Interested
- Explore / Fresh Faces / Rising / Trending
- ARToF Studio
- Body presets and Studio options loaded from Supabase
- Draft Looks
- Server-side vector rendering
- Visual reference upload pipeline
- Reference validation and attachment
- AI reference generation hook through `generate-reference-look`
- Publish flow and post interests
- Charts, Companies, Activity and Profile

## Backend

Staging Supabase project only. No service-role key is stored in this repository.

The frontend uses the Supabase publishable key and authenticated Edge Functions. The private OpenAI provider key, when configured, belongs only in Supabase Edge Function secrets.

## Deploy

This is a static web app and can be deployed directly on Vercel. Use the repository root as the project root. No build command is required for this version.

## Status

Development/staging. Not production-ready yet.
