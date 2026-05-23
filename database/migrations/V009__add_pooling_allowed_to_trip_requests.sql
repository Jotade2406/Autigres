-- Add opt-in pooling flag. Default TRUE keeps all existing requests pooling-eligible.
ALTER TABLE trip_requests
ADD COLUMN is_pooling_allowed TINYINT(1) NOT NULL DEFAULT 1
AFTER max_detour_seconds;
