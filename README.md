# Smart Shelter Monitoring System

IoT monitoring system for telecommunications shelters, built with a team of three for Telkom Indonesia. It tracks temperature, humidity, and vibration, and sends real-time alerts to Telegram when readings are abnormal.

## Architecture
ESP32 sensors → MQTT broker → Python bridge → Supabase → Web dashboard
                                            ↘ Telegram bot alerts

## Hardware
- ESP32 microcontroller
- SHT3x temperature and humidity sensor
- MPU6050 vibration sensor
- Multi-color LED status indicators

## Software
- **Firmware:** Arduino (C++)
- **Messaging:** MQTT
- **Backend bridge:** Python (MQTT to database)
- **Database:** Supabase
- **Dashboard:** [framework, for example Next.js]
- **Alerts:** Telegram bot

## My contribution
Python backend bridge, database architecture, web application, Telegram alert pipeline, and full-stack deployment.

## Research
This project supports a published paper that evaluates alert reliability (trigger accuracy, response time, and end-to-end delivery consistency):
*Evaluating Event-Driven IoT Alert Reliability for Temperature, Humidity, and Vibration Monitoring in an ESP32-Based Shelter System* [add link]

## Getting started
[Short setup steps: flash firmware, set MQTT credentials, run the bridge, open the dashboard]

## Screenshots
[Dashboard screenshot, Telegram alert screenshot, wiring photo]
