Add troupe editing with photo upload to the Troupe app. This builds on Phase 2.
Only owners can edit a troupe. Do not build any other features.

## Infrastructure — Cloudflare R2

### R2 bucket setup (document in README, do not automate)
  - Bucket name: troupe-badges
  - Public access: enabled via Cloudflare R2 public URL
  - CORS: allow PUT from the app's origin
  - The bucket serves files at a stable public base URL configured via 
    environment variable: R2_PUBLIC_URL

### New environment variables
Add to packages/server/.env.example:
  R2_ACCOUNT_ID=
  R2_ACCESS_KEY_ID=
  R2_SECRET_ACCESS_KEY=
  R2_BUCKET_NAME=troupe-badges
  R2_PUBLIC_URL=              -- e.g. https://pub-xxx.r2.dev

Add to packages/client/.env.example:
  VITE_R2_PUBLIC_URL=         -- same value, needed for constructing badge URLs

---

## Image processing

### Install sharp in packages/server
Use sharp for server-side image resizing and cropping.

### Image processing rules
When a troupe badge is uploaded:
  1. Accept the original upload (JPEG, PNG, WebP only — reject all others with 400)
  2. Max file size: 5MB — reject larger files with 400
  3. Use sharp to produce three variants from the original:
     - thumbnail: 64x64px, circular crop via SVG mask, WebP format, quality 80
     - standard:  128x128px, circular crop via SVG mask, WebP format, quality 85
     - large:     256x256px, circular crop via SVG mask, WebP format, quality 90
  4. Circular crop implementation using sharp:

     const circle = Buffer.from(
       `<svg><circle cx="${size/2}" cy="${size/2}" r="${size/2}"/></svg>`
     )
     const processed = await sharp(buffer)
       .resize(size, size, { fit: 'cover', position: 'centre' })
       .composite([{ input: circle, blend: 'dest-in' }])
       .webp({ quality })
       .toBuffer()

  5. Upload all three variants to R2 under a deterministic key structure:
     badges/{troupeId}/thumbnail.webp
     badges/{troupeId}/standard.webp
     badges/{troupeId}/large.webp
  6. Overwrite existing files on re-upload — no versioning needed

### R2 upload helper: packages/server/src/lib/r2.ts
Use the @aws-sdk/client-s3 package (R2 is S3-compatible):
  - Configure the S3 client with R2 endpoint, account ID, and credentials
  - Export uploadToR2(key, buffer, contentType): Promise<void>
  - Export deleteFromR2(key): Promise<void>
  - Set Cache-Control header on every upload:
    Cache-Control: public, max-age=31536000, immutable
    This maximises Cloudflare edge caching and browser caching since badge 
    URLs are stable per troupe — files are overwritten in place on update

---

## Database
Create a new migration file: db/migrations/004_add_badge_to_troupes.sql

  ALTER TABLE troupes ADD COLUMN has_badge BOOLEAN NOT NULL DEFAULT FALSE;

  -- Down migration
  ALTER TABLE troupes DROP COLUMN has_badge;

### Why has_badge instead of storing the URL
Badge URLs are fully deterministic from the troupeId and R2_PUBLIC_URL:
  {R2_PUBLIC_URL}/badges/{troupeId}/thumbnail.webp
  {R2_PUBLIC_URL}/badges/{troupeId}/standard.webp
  {R2_PUBLIC_URL}/badges/{troupeId}/large.webp

Storing has_badge (boolean) is sufficient to know whether to render the badge 
or fall back to the initials placeholder. URLs are constructed in a single 
helper function — never stored in the database.

### Badge URL helper: packages/server/src/lib/badgeUrl.ts
  export function getBadgeUrls(troupeId: string) {
    const base = process.env.R2_PUBLIC_URL
    return {
      thumbnail: `${base}/badges/${troupeId}/thumbnail.webp`,
      standard:  `${base}/badges/${troupeId}/standard.webp`,
      large:     `${base}/badges/${troupeId}/large.webp`,
    }
  }

Add a matching helper in packages/client/src/lib/badgeUrl.ts using 
import.meta.env.VITE_R2_PUBLIC_URL instead.

---

## Backend

### New route: PATCH /api/troupes/:troupeId
Update troupe name. Owner only — return 403 for organizer or member.

Request body:
  { name: string }

Validation:
  - name: required, non-empty, max 100 characters, trim whitespace
  - Requesting user must be the owner — check via troupe_members

Response (200): updated TroupeSummary including has_badge and badge URLs 
if has_badge is true

Error responses:
  - 400 if name is missing, empty, or exceeds 100 characters
  - 403 if user is not the owner
  - 404 if troupe not found
  - 500 for unexpected errors

### New route: POST /api/troupes/:troupeId/badge
Upload or replace a troupe badge. Owner only — return 403 for organizer or member.

Use multer for multipart/form-data parsing with these constraints:
  - limits: { fileSize: 5 * 1024 * 1024 }
  - fileFilter: accept only image/jpeg, image/png, image/webp

Processing steps (must all succeed before responding):
  1. Validate file presence and type
  2. Process all three size variants with sharp
  3. Upload all three variants to R2
  4. Set has_badge = TRUE on the troupes row
  5. Return the updated troupe with badge URLs

Response (200):
  {
    id: string
    name: string
    hasBadge: boolean
    badges: {
      thumbnail: string
      standard: string
      large: string
    }
  }

If any R2 upload fails, do not update has_badge — return 500 with a clear 
error message. The three uploads should be done in parallel with Promise.all.

Error responses:
  - 400 if no file provided
  - 400 if file type is not accepted
  - 400 if file exceeds 5MB
  - 403 if user is not the owner
  - 404 if troupe not found
  - 500 if R2 upload fails

### Update TroupeSummary response shape
All routes that return troupe data must now include:
  hasBadge: boolean
  badges: {
    thumbnail: string
    standard: string
    large: string
  } | null   -- null if hasBadge is false

---

## Types
Update packages/server/src/types/troupe.ts:

  export interface TroupeBadges {
    thumbnail: string
    standard: string
    large: string
  }

  export interface TroupeSummary {
    id: string
    name: string
    role: TroupeRole
    memberCount: number
    createdAt: string
    hasBadge: boolean
    badges: TroupeBadges | null
  }

---

## Frontend

### Badge display component: packages/client/src/components/TroupeBadge.tsx
A single reusable component used everywhere a troupe badge appears:

  Props:
    troupe: { id: string, name: string, hasBadge: boolean }
    size: 'thumbnail' | 'standard' | 'large'
    className?: string

  Behaviour:
    - If hasBadge is true: render an <img> using the appropriate badge URL
      from the client-side badgeUrl helper
    - If hasBadge is false: render a circular placeholder div with:
        - Background: a consistent colour derived from the troupe id 
          (hash the id to pick from a set of 6 brand colours)
        - Text: the first 1-2 initials of the troupe name, uppercase
        - Same dimensions as the requested size variant
    - Always render as a circle (border-radius: 9999px)
    - img elements must include loading="lazy" and a descriptive alt attribute

  Size dimensions:
    thumbnail → 64x64px
    standard  → 128x128px
    large     → 256x256px

### Update TroupeCard.tsx
  - Add TroupeBadge (size="standard") to the left side of the card
  - The card layout should accommodate the badge naturally on both mobile 
    and desktop

### Update TroupeDetailPage.tsx
  - Show TroupeBadge (size="large") in the troupe header next to the name
  - If the user is the owner, show an "Edit Troupe" button in the header

### New component: packages/client/src/components/EditTroupeModal.tsx
A modal triggered by the "Edit Troupe" button. Only rendered for owners.
Contains two sections:

  Section 1 — Troupe Name:
    - Pre-filled text input with the current troupe name
    - Character counter (max 100)
    - "Save Name" button — only enabled if the name has changed and is valid
    - Calls PATCH /api/troupes/:troupeId on submit

  Section 2 — Troupe Badge:
    - Current badge preview using TroupeBadge (size="large")
    - "Upload Photo" button that triggers a hidden file input
    - Accepted formats listed: JPG, PNG, WebP — max 5MB
    - On file selection: show a preview of the selected image before upload
      using URL.createObjectURL — do not upload until the user confirms
    - "Upload Badge" confirm button — disabled while uploading
    - Upload progress indicator while uploading
    - On success: update the troupe state with new badge URLs, 
      show a success message
    - Inline error messages for file type or size violations

  Both sections operate independently — saving the name does not require 
  uploading a badge and vice versa.
  Use shadcn/ui Dialog component.

### Update useTroupes.ts hook
  - Add updateTroupeName(troupeId, name): calls PATCH /api/troupes/:troupeId
  - Add uploadTroupeBadge(troupeId, file): calls POST /api/troupes/:troupeId/badge
    with FormData
  - On success of either, update the troupe in the local troupes list 
    without a full refetch

---

## Caching strategy
Document in README.md under a "Media & Caching" section:

  - All R2 badge files are served with Cache-Control: public, max-age=31536000, immutable
  - Badge URLs are stable and deterministic — they never change per troupe
  - When a badge is re-uploaded, the file is overwritten at the same URL
  - Cloudflare's edge cache will serve the old image until the CDN TTL expires
  - To force cache invalidation on re-upload, append a cache-busting query 
    param to badge URLs using the troupe's updated_at timestamp:
    {R2_PUBLIC_URL}/badges/{troupeId}/standard.webp?v={updatedAt unix timestamp}
  - Store updated_at on the troupe in the API response so the client can 
    construct cache-busted URLs
  - This gives long-term caching for unchanged badges and immediate 
    freshness on update

### Update badgeUrl helpers (both client and server)
  Both getBadgeUrls helpers must accept an optional updatedAt parameter 
  and append ?v={unix timestamp} when provided:

  export function getBadgeUrls(troupeId: string, updatedAt?: Date) {
    const base = ...
    const v = updatedAt ? `?v=${Math.floor(updatedAt.getTime() / 1000)}` : ''
    return {
      thumbnail: `${base}/badges/${troupeId}/thumbnail.webp${v}`,
      standard:  `${base}/badges/${troupeId}/standard.webp${v}`,
      large:     `${base}/badges/${troupeId}/large.webp${v}`,
    }
  }

---

## CLAUDE.md
Update CLAUDE.md:
  - Add the following conventions:

    ### Media & Storage
    - All troupe badge images stored in Cloudflare R2
    - Badge URLs are deterministic — never stored in the database
    - has_badge (boolean) on the troupes table is the only DB record needed
    - Three sizes generated server-side on upload: 64px, 128px, 256px
    - All variants are circular-cropped WebP using sharp
    - Cache-Control: public, max-age=31536000, immutable on all R2 uploads
    - Cache busting via ?v={updatedAt unix timestamp} query param
    - Badge URL construction always goes through getBadgeUrls() helper — 
      never construct URLs inline
    - Owner only: name editing and badge upload
    - TroupeBadge component is the single source of truth for badge rendering

---

## Constraints
  - sharp runs server-side only — no client-side image processing
  - All three size variants uploaded in parallel via Promise.all
  - has_badge is only set to TRUE after all three R2 uploads succeed
  - Badge URLs are never stored in the database
  - File preview before upload uses URL.createObjectURL — no server round trip
  - Only owners can edit name or upload badge — enforced in API layer
  - Do not build member management, invite codes, polls, or any Phase 4 features
  - Mobile-first on all new components