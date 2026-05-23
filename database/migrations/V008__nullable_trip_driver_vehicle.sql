-- V008: Allow trips to exist without a driver/vehicle (status=scheduled, driver assigned later)
-- The pooling engine creates trips when two requests match; driver assignment happens separately.

ALTER TABLE trips
    MODIFY COLUMN driver_id  INT NULL,
    MODIFY COLUMN vehicle_id INT NULL;
