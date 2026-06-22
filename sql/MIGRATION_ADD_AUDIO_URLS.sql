-- Migration: add audio URL columns to words
-- Run once in Supabase Dashboard → SQL Editor

ALTER TABLE words
  ADD COLUMN IF NOT EXISTS audio_url_uk text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS audio_url_us text DEFAULT NULL;
