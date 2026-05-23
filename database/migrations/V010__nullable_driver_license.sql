-- Allow drivers to register without license info upfront (added later via profile).
-- MySQL UNIQUE indexes allow multiple NULL values, so uniqueness is preserved for real plates.
ALTER TABLE drivers
  MODIFY COLUMN license_number VARCHAR(50) NULL,
  MODIFY COLUMN license_expiry DATE NULL;
