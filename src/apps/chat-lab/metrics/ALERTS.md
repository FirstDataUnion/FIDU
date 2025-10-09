# ChatLab Alert Rules

This document describes the alert rules for monitoring ChatLab service availability and health.

## Overview

The alert rules in `chatlab-alerts.yml` monitor:
- ✅ **Service availability** (down, unhealthy, unreachable)
- ✅ **Backend errors** (5xx errors, request failures)
- ✅ **Service degradation** (performance issues, restarts)
- ✅ **Dependencies** (AI models, Google Drive API)

## Alert Groups

### 1. chatlab-availability (Critical)

**Priority: HIGHEST** - These alerts indicate ChatLab is unavailable to users.

#### ChatLabServiceUnhealthy
- **Severity:** Critical
- **Trigger:** Health status = 0 for 1 minute
- **Meaning:** Service is running but unhealthy
- **Action:** Check service logs immediately

#### ChatLabServiceDown
- **Severity:** Critical
- **Trigger:** No metrics for 2 minutes
- **Meaning:** Service is completely down
- **Action:** Check if service is running

#### ChatLabHighServerErrorRate
- **Severity:** Critical
- **Trigger:** >10% of requests return 5xx errors for 3 minutes
- **Meaning:** Backend is failing requests
- **Action:** Check backend logs and database connectivity

#### ChatLabNoSuccessfulRequests
- **Severity:** Critical
- **Trigger:** All requests failing for 5 minutes
- **Meaning:** Complete service failure
- **Action:** Immediate investigation required

### 2. chatlab-performance (Warning)

**Priority: MEDIUM** - Service is up but degraded.

#### ChatLabHighResponseTime
- **Severity:** Warning
- **Trigger:** P95 response time > 5 seconds for 5 minutes
- **Meaning:** Service is slow
- **Action:** Check server load and performance

### 3. chatlab-dependencies (Critical/Warning)

**Priority: VARIES** - External services affecting ChatLab.

#### ChatLabAllModelsFailure
- **Severity:** Critical
- **Trigger:** All AI model requests failing for 5 minutes
- **Meaning:** NLP Workbench or AI APIs are down
- **Action:** Check NLP Workbench status

#### ChatLabGoogleDriveDown
- **Severity:** Warning
- **Trigger:** All Google Drive requests failing for 10 minutes
- **Meaning:** Google API issues or authentication problems
- **Action:** Check Google API status and logs

## Alert Details

### Critical Alerts (Immediate Action Required)

| Alert | Environment | For | Description |
|-------|-------------|-----|-------------|
| ChatLabServiceUnhealthy | prod | 1m | Service reports unhealthy status |
| ChatLabServiceDown | prod | 2m | No metrics received (service completely down) |
| ChatLabHighServerErrorRate | prod | 3m | >10% 5xx errors |
| ChatLabNoSuccessfulRequests | prod | 5m | All requests failing |
| ChatLabAllModelsFailure | prod | 5m | All AI models failing |

### Warning Alerts (Monitor and Investigate)

| Alert | Environment | For | Description |
|-------|-------------|-----|-------------|
| ChatLabServiceUnhealthyDev | dev | 5m | Dev environment unhealthy |
| ChatLabElevatedErrorRate | prod | 10m | >1 error/sec from frontend |
| ChatLabServiceRestarted | prod | 0s | Service restart detected |
| ChatLabMetricsStale | prod | 2m | Metrics not updating |
| ChatLabHighResponseTime | prod | 5m | P95 latency >5s |
| ChatLabGoogleDriveDown | prod | 10m | Google Drive API failing |

## Troubleshooting Guide

### Alert: ChatLabServiceUnhealthy

**What it means:** Service is running but reports unhealthy.

**Investigation steps:**
```bash
# 1. Check service status
sudo systemctl status fidu-chat-lab-prod

# 2. Check logs
sudo journalctl -u fidu-chat-lab-prod -n 100

# 3. Check health endpoint
curl http://localhost:8118/health

# 4. Check if dist directory exists
ls -la /usr/local/bin/fidu-chat-lab-prod/dist/
```

**Common causes:**
- Dist directory missing or empty
- File permission issues
- Service initialization error

**Resolution:**
- Redeploy: `./deploy.sh prod YOUR_SERVER_IP`
- Check file permissions
- Review service logs

---

### Alert: ChatLabServiceDown

**What it means:** Service is completely down - no metrics received.

**Investigation steps:**
```bash
# 1. Check if service is running
sudo systemctl status fidu-chat-lab-prod

# 2. Try to start service
sudo systemctl start fidu-chat-lab-prod

# 3. Check logs for crash
sudo journalctl -u fidu-chat-lab-prod -n 200

# 4. Check if port is bound
sudo netstat -tlnp | grep 8118

# 5. Check VictoriaMetrics connectivity
curl http://localhost:8428/health
```

**Common causes:**
- Service crashed
- Port conflict
- Python dependencies missing
- VictoriaMetrics unreachable

**Resolution:**
- Restart service: `sudo systemctl restart fidu-chat-lab-prod`
- Check dependencies: `source venv/bin/activate && pip list`
- Redeploy if needed

---

### Alert: ChatLabHighServerErrorRate

**What it means:** High rate of 5xx errors from backend.

**Investigation steps:**
```bash
# 1. Check error logs
sudo journalctl -u fidu-chat-lab-prod -n 100 | grep -i error

# 2. Check recent errors in VictoriaMetrics
curl -s 'http://localhost:8428/api/v1/query?query=chatlab_backend_requests_total{status=~"5.."}'

# 3. Check disk space
df -h

# 4. Check memory
free -h
```

**Common causes:**
- Database connectivity issues
- Disk full
- Out of memory
- Code errors

**Resolution:**
- Review error logs
- Check system resources
- Restart service if needed
- Fix underlying issue and redeploy

---

### Alert: ChatLabNoSuccessfulRequests

**What it means:** Service is receiving requests but ALL are failing.

**Investigation steps:**
```bash
# 1. Immediate: Check service logs
sudo journalctl -u fidu-chat-lab-prod -n 50

# 2. Check if service is responding
curl http://localhost:8118/health

# 3. Check error details
curl http://localhost:8118/fidu-chat-lab/ -v

# 4. Check backend requests
curl -s 'http://localhost:8428/api/v1/query?query=chatlab_backend_requests_total'
```

**Common causes:**
- Critical service error
- Database down
- File system issues
- Authentication broken

**Resolution:**
- This is critical - investigate immediately
- May need to restart or redeploy
- Check all dependencies

---

### Alert: ChatLabMetricsStale

**What it means:** Metrics haven't updated in 2+ minutes.

**Investigation steps:**
```bash
# 1. Check if metrics are being sent to VictoriaMetrics
sudo journalctl -u fidu-chat-lab-prod -n 50 | grep -i "metric\|victoria"

# 2. Check VictoriaMetrics
curl http://localhost:8428/health

# 3. Check timestamp of metrics
curl -s 'http://localhost:8428/api/v1/query?query=chatlab_health_status' | jq

# 4. Check service status
sudo systemctl status fidu-chat-lab-prod
```

**Common causes:**
- VictoriaMetrics down or unreachable
- Network issues
- Service still running but metrics forwarding broken

**Resolution:**
- Check VictoriaMetrics status
- Restart ChatLab service if needed
- Check network connectivity

---

### Alert: ChatLabAllModelsFailure

**What it means:** All AI model requests are failing.

**Investigation steps:**
```bash
# 1. Check NLP Workbench status
systemctl status nlp-workbench

# 2. Check ChatLab logs for model errors
sudo journalctl -u fidu-chat-lab-prod -n 100 | grep -i "model\|nlp\|api"

# 3. Check model request metrics
curl -s 'http://localhost:8428/api/v1/query?query=chatlab_messages_sent_total'

# 4. Test NLP Workbench endpoint
curl http://localhost:NLP_PORT/health
```

**Common causes:**
- NLP Workbench service down
- API authentication issues
- Network connectivity
- API rate limiting

**Resolution:**
- Check NLP Workbench service
- Verify API keys/tokens
- Check network connectivity
- Review error logs

## Testing Alerts

### Simulate Service Down

```bash
# Stop the service
sudo systemctl stop fidu-chat-lab-prod

# Wait 2 minutes - should trigger ChatLabServiceDown alert

# Check alert status
curl -s http://localhost:8880/api/v1/alerts | jq '.data.alerts[] | select(.labels.alertname == "ChatLabServiceDown")'

# Restart service
sudo systemctl start fidu-chat-lab-prod
```

### Simulate Unhealthy Service

This is harder to simulate without modifying code, but you can:

```bash
# Remove dist directory (service will become unhealthy)
sudo mv /usr/local/bin/fidu-chat-lab-prod/dist /tmp/dist-backup

# Wait 1 minute - should trigger ChatLabServiceUnhealthy alert

# Restore
sudo mv /tmp/dist-backup /usr/local/bin/fidu-chat-lab-prod/dist
```

### Check Current Alert Status

```bash
# All active alerts
curl -s http://localhost:8880/api/v1/alerts | jq '.data.alerts[] | select(.labels.service == "chatlab")'

# Specific alert
curl -s http://localhost:8880/api/v1/alerts | jq '.data.alerts[] | select(.labels.alertname == "ChatLabServiceDown")'

# Alert rules (not fired alerts)
curl -s http://localhost:8880/api/v1/rules | jq '.data.groups[] | select(.name | contains("chatlab"))'
```

## Alert Channels

Alerts are sent through your Alertmanager configuration. Common channels:

### Discord
Check `/Users/oli/Documents/Programming/FIDU-Online-Services/monitoring/alertmanager.yml`

### Email
Configure in Alertmanager:
```yaml
receivers:
  - name: 'email'
    email_configs:
      - to: 'your-email@example.com'
        from: 'alerts@fidu.com'
        smarthost: 'smtp.gmail.com:587'
```

### Slack
Add to Alertmanager:
```yaml
receivers:
  - name: 'slack'
    slack_configs:
      - api_url: 'YOUR_WEBHOOK_URL'
        channel: '#alerts'
```

## Customization

### Adjust Alert Thresholds

Edit `chatlab-alerts.yml`:

```yaml
# Example: Make service down alert less sensitive (wait longer)
- alert: ChatLabServiceDown
  expr: absent(chatlab_health_status{environment="prod"})
  for: 5m  # Changed from 2m to 5m
```

### Add Environment-Specific Alerts

```yaml
# Alert only for production
- alert: ChatLabProdHighLoad
  expr: rate(chatlab_backend_requests_total{environment="prod"}[5m]) > 100
  for: 5m
```

### Change Alert Severity

```yaml
# Make an alert more severe
- alert: ChatLabServiceDown
  labels:
    severity: critical  # was: warning
```

After editing, redeploy:
```bash
sudo cp metrics/chatlab-alerts.yml /etc/vmalert/rules/
sudo systemctl restart vmalert
```

## Best Practices

1. **Test alerts after deployment** - Verify they fire when they should
2. **Monitor alert frequency** - Too many alerts = alert fatigue
3. **Update runbook URLs** - Link to your actual documentation
4. **Adjust thresholds** - Based on your actual traffic patterns
5. **Environment-specific rules** - Prod should be more sensitive than dev
6. **Group related alerts** - Easier to manage and understand

## Maintenance

### Review Alerts Monthly
- Check for false positives
- Adjust thresholds based on actual behavior
- Add new alerts for new features
- Remove obsolete alerts

### After Each Deployment
- Verify alerts still work
- Update alert thresholds if needed
- Test critical alerts


## References

- [VMAlert Documentation](https://docs.victoriametrics.com/vmalert.html)
- [Alertmanager Configuration](https://prometheus.io/docs/alerting/latest/configuration/)
- [PromQL Syntax](https://prometheus.io/docs/prometheus/latest/querying/basics/)

