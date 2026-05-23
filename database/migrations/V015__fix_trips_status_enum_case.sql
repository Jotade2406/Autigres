-- Fix trips.status ENUM to PascalCase to match EF Core string conversion
ALTER TABLE trips
  MODIFY COLUMN status ENUM('Scheduled','DriverAssigned','InProgress','Completed','Cancelled')
  NOT NULL DEFAULT 'Scheduled';
