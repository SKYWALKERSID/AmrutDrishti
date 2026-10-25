@echo off
set "PYTHONPATH=F:\Projects\JalDrishti"
set "JALDRISHTI_MODEL_SERVICE_PORT=8081"
if not defined JALDRISHTI_MODEL_SERVICE_TOKEN (
  echo Set JALDRISHTI_MODEL_SERVICE_TOKEN to a local secret before starting the model service.
  exit /b 1
)
python -m ml.serving
