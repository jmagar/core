#!/bin/sh

# Exit on any error
set -e

echo "Starting init CLI..."

# Wait for database to be ready
echo "Waiting for database connection..."
until pg_isready -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${POSTGRES_USER:-docker}"; do
  echo "Database is unavailable - sleeping"
  sleep 2
done

echo "Database is ready!"

# Run the init command
echo "Running init command..."
node ./dist/esm/index.js init

echo "Init completed successfully!"
exit 0