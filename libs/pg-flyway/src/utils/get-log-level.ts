export function getLogLevel() {
  return (process.env['DEBUG'] === '*' ? 'all' : process.env['FLYWAY_LOG_LEVEL'] || process.env['DEBUG']) || 'info';
}
