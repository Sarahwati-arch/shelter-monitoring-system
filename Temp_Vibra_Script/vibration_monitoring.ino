#include <Wire.h>
#include <MPU6050_light.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>  

// MPU
MPU6050 mpu(Wire);

// EMA FILTER
float fax = 0, fay = 0, faz = 0;
float fgx = 0, fgy = 0, fgz = 0;
float alpha = 0.1;

#define LED_RED    25
#define LED_YELLOW 26
#define LED_GREEN  27
#define BUZZER_PIN 5

// GRAVITY CONSTANT (ISO 80000-3 standard gravity, g0)
#define GRAVITY_STD 9.80665

// VIBRATION THRESHOLDS
float vibWarning = 1500.0;
float vibCritical = 2500.0;

float vibLevelPeak = 0;
float axPeak = 0, ayPeak = 0, azPeak = 0;

// WIFI & MQTT
const char* ssid        = "your wifi";
const char* password    = "your wifi password";
const char* mqtt_server = "broker.emqx.io";
const int   mqtt_port   = 1883;

// Topics
const char* topic_accel  = "tok_esp32_vib_alpha_001/Accel";
const char* topic_gyro   = "tok_esp32_vib_alpha_001/Gyro";
const char* topic_config = "tok_esp32_vib_alpha_001/Config";

WiFiClient espClient;
PubSubClient client(espClient);

// SENSOR INTERVAL
unsigned long sensorInterval   = 1000;

unsigned long lastPublishTime  = 0;
unsigned long previousBuzzerMillis = 0;
bool buzzerState = false;

enum StatusLevel { NORMAL, WARNING, CRITICAL };
StatusLevel currentStatus = NORMAL;

unsigned long statusHoldStart = 0;
const unsigned long HOLD_DURATION = 3000; 

void setup_wifi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  char buf[128];
  unsigned int len = min(length, (unsigned int)(sizeof(buf) - 1));
  memcpy(buf, payload, len);
  buf[len] = '\0';

  Serial.print("[MQTT] Received on ");
  Serial.print(topic);
  Serial.print(": ");
  Serial.println(buf);

  StaticJsonDocument<128> doc;
  DeserializationError err = deserializeJson(doc, buf);
  if (err) {
    Serial.print("[MQTT] JSON parse error: ");
    Serial.println(err.c_str());
    return;
  }

  if (doc.containsKey("vib_interval_ms")) {
    unsigned long newInterval = doc["vib_interval_ms"].as<unsigned long>();
    if (newInterval >= 1000 && newInterval <= 60000) {
      sensorInterval = newInterval;
      Serial.print("[Config] Vibration interval updated to: ");
      Serial.print(sensorInterval);
      Serial.println(" ms");
    } else {
      Serial.println("[Config] Interval out of range (1000–60000), ignored.");
    }
  }

  if (doc.containsKey("vib_warn")) {
    vibWarning = doc["vib_warn"].as<float>();
    Serial.print("[Config] Vib Warning updated to: ");
    Serial.print(vibWarning);
    Serial.println(" mg");
  }
  
  if (doc.containsKey("vib_crit")) {
    vibCritical = doc["vib_crit"].as<float>();
    Serial.print("[Config] Vib Critical updated to: ");
    Serial.print(vibCritical);
    Serial.println(" mg");
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("MQTT connecting...");
    if (client.connect("ESP32-VIB-Alpha")) {
      Serial.println("connected");
      client.subscribe(topic_config);
      Serial.print("Subscribed to: ");
      Serial.println(topic_config);
    } else {
      Serial.print("failed, rc=");
      Serial.println(client.state());
      delay(2000);
    }
  }
}

void updateStatus(float vibLevel) {
  StatusLevel rawStatus;

  if (vibLevel >= vibCritical) {
    rawStatus = CRITICAL;
  } else if (vibLevel >= vibWarning) {
    rawStatus = WARNING;
  } else {
    rawStatus = NORMAL;
  }

  unsigned long now = millis();

  if (rawStatus > currentStatus) {
    currentStatus = rawStatus;
    statusHoldStart = now;
  } else if (rawStatus < currentStatus) {
    if (now - statusHoldStart >= HOLD_DURATION) {
      currentStatus = rawStatus;
      statusHoldStart = now;
    }
  } else {
    statusHoldStart = now;
  }

  digitalWrite(LED_GREEN,  currentStatus == NORMAL   ? HIGH : LOW);
  digitalWrite(LED_YELLOW, currentStatus == WARNING  ? HIGH : LOW);
  digitalWrite(LED_RED,    currentStatus == CRITICAL ? HIGH : LOW);
}

void handleBuzzer() {
  if (currentStatus == NORMAL) {
    digitalWrite(BUZZER_PIN, LOW);
  } else if (currentStatus == CRITICAL) {
    digitalWrite(BUZZER_PIN, HIGH);
  } else if (currentStatus == WARNING) {
    unsigned long currentMillis = millis();
    if (currentMillis - previousBuzzerMillis >= 500) {
      previousBuzzerMillis = currentMillis;
      buzzerState = !buzzerState;
      digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n--- VIBRATION SENSOR BOOTING ---");

  pinMode(LED_RED,    OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_GREEN,  OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  updateStatus(0.0);

  Wire.begin(23, 22, 400000);

  Serial.println("Initializing MPU6050 (I2C 23, 22)...");
  if (mpu.begin() != 0) {
    Serial.println("MPU6050 FAILED! Cek kabel SDA/SCL.");
    while (1) {
      delay(1000);
      Serial.println("MPU6050 Error loop...");
    }
  }
  Serial.println("MPU6050 READY");

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqttCallback);
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop(); 

  mpu.update();

  float ax = mpu.getAccX();
  float ay = mpu.getAccY();
  float az = mpu.getAccZ();
  float gx = mpu.getGyroX();
  float gy = mpu.getGyroY();
  float gz = mpu.getGyroZ();

  // EMA filter
  fax = alpha * ax + (1 - alpha) * fax;
  fay = alpha * ay + (1 - alpha) * fay;
  faz = alpha * az + (1 - alpha) * faz;
  fgx = alpha * gx + (1 - alpha) * fgx;
  fgy = alpha * gy + (1 - alpha) * fgy;
  fgz = alpha * gz + (1 - alpha) * fgz;

  float ax_ms2 = fax * GRAVITY_STD;
  float ay_ms2 = fay * GRAVITY_STD;
  float az_ms2 = faz * GRAVITY_STD;

  float vibLevel_ms2 = sqrt(ax_ms2*ax_ms2 + ay_ms2*ay_ms2 + az_ms2*az_ms2);
  float vibLevel = (vibLevel_ms2 / GRAVITY_STD) * 1000.0;

  if (vibLevel > vibLevelPeak) {
    vibLevelPeak = vibLevel;
    axPeak = fax;
    ayPeak = fay;
    azPeak = faz;
  }

  updateStatus(vibLevelPeak);
  handleBuzzer();

  unsigned long currentMillis = millis();
  if (currentMillis - lastPublishTime >= sensorInterval) {
    lastPublishTime = currentMillis;

    Serial.println("=== VIBRATION DATA ===");
    Serial.print("accel_x: "); Serial.println(axPeak, 3);
    Serial.print("accel_y: "); Serial.println(ayPeak, 3);
    Serial.print("accel_z: "); Serial.println(azPeak, 3);
    Serial.print("gyro_x:  "); Serial.println(fgx, 3);
    Serial.print("gyro_y:  "); Serial.println(fgy, 3);
    Serial.print("gyro_z:  "); Serial.println(fgz, 3);
    Serial.printf("vibLevel (peak): %.1f mg | Interval: %lums\n\n", vibLevelPeak, sensorInterval);

    char accelPayload[180];
    snprintf(accelPayload, sizeof(accelPayload),
      "{\"accel_x\":%.3f,\"accel_y\":%.3f,\"accel_z\":%.3f,\"vibLevel\":%.1f,\"unit\":\"mg\"}",
      axPeak, ayPeak, azPeak, vibLevelPeak
    );
    client.publish(topic_accel, accelPayload);

    char gyroPayload[150];
    snprintf(gyroPayload, sizeof(gyroPayload),
      "{\"gyro_x\":%.3f,\"gyro_y\":%.3f,\"gyro_z\":%.3f}",
      fgx, fgy, fgz
    );
    client.publish(topic_gyro, gyroPayload);

    vibLevelPeak = 0;
  }
}
