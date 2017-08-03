'use strict'

/**
 * New Relic agent configuration.
 *
 * See lib/config.default.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
exports.config = {
  /**
   * Application name.
   * 'TP Auth Server - DEV' or 'TP Auth Server'
   */
  app_name: 'TP ServiceName Server - DEV',
  /**
   * Your New Relic license key.
   */
  license_key: 'e4ae15e7428ade341ea04d98e45f50affdd0ecf4',
  logging: {
    /**
     * Level at which to log. 'trace' is most useful to New Relic when diagnosing
     * issues with the agent, 'info' and higher will impose the least overhead on
     * production applications.
     */
    level: 'info'
  }
}
