#!/bin/sh
set -eu

url="${DATABASE_URL:-}"
case "$url" in
  *supabase.co*|*pooler.supabase.com*)
    case "$url" in
      *sslmode=*) ;;
      *\?*) DATABASE_URL="${url}&sslmode=require" ;;
      *) DATABASE_URL="${url}?sslmode=require" ;;
    esac
    export DATABASE_URL
    ;;
esac

./node_modules/.bin/prisma migrate deploy
exec node --import tsx scripts/server.mjs
