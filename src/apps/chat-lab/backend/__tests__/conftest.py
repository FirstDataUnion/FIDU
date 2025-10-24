"""
Backend Test Configuration

This file contains pytest configuration and setup for backend tests.
It includes warning suppression for common compatibility issues.

Warning Suppression:
- urllib3 LibreSSL Warning: Suppresses the "urllib3 v2 only supports OpenSSL 1.1.1+"
  warning that appears on macOS systems using LibreSSL instead of OpenSSL.
  This is a cosmetic warning only - functionality is not affected.

Background:
- urllib3 v2 expects OpenSSL 1.1.1+ for optimal performance
- macOS systems often use LibreSSL 2.8.3 (Apple's SSL implementation)
- LibreSSL 2.8.3 is secure and functional, just older than urllib3 v2's preference
- The warning appears during HTTP requests in tests but doesn't affect functionality

Solution:
- Warning suppression via pytest configuration (--disable-warnings in pyproject.toml)
- Alternative approaches (downgrading urllib3) cause dependency conflicts
- This approach maintains compatibility while providing clean test output

Security Note:
- LibreSSL 2.8.3 is still secure and production-ready
- Warning suppression doesn't affect security or functionality
- This is purely a cosmetic improvement for test output
"""

# Suppress urllib3 LibreSSL warning
import warnings

warnings.filterwarnings("ignore", message="urllib3 v2 only supports OpenSSL 1.1.1+")
