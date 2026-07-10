#include <Wire.h>
#include <MPU6050_light.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>  // Install via Library Manager: "ArduinoJson" by Benoit Blanchon


// MPU
MPU6050 mpu(Wire);

// EMA FILTER
float fax = 0, fay = 0, faz = 0;
float fgx = 0, fgy = 0, fgz = 0;
float alpha = 0.1;

// LED & BUZZER PINS
#define LED_RED    25
#define LED_YELLOW 26
#define LED_GREEN  27
#define BUZZER_PIN 5

// --- VIBRATION THRESHOLDS (local defaults, overridable via MQTT config) ---
float vibWarning = 0.3;
float vibCritical = 0.7;

// WIFI & MQTT
const char* ssid        = "Wifi 2";
const char* password    = "rb234567";
const char* mqtt_server = "broker.emqx.io";
const int   mqtt_port   = 1883;

// Topics
const char* topic_accel  = "tok_esp32_vib_alpha_001/Accel";
const char* topic_gyro   = "tok_esp32_vib_alpha_001/Gyro";
const char* topic_config = "tok_esp32_vib_alpha_001/Config";

WiFiClient espClient;
PubSubClient client(espClient);


// --- SENSOR INTERVAL (ms) — configurable via MQTT ---
unsigned long sensorInterval   = 1000;   // default 1 detik

// --- NON-BLOCKING TIMERS ---
unsigned long lastPublishTime  = 0;
unsigned long previousBuzzerMillis = 0;
bool buzzerState = false;

// --- STATUS SENSOR SAAT INI ---
enum StatusLevel { NORMAL, WARNING, CRITICAL };
StatusLevel currentStatus = NORMAL;


// ---------------------------------------------------------------------------
// WiFi
// ---------------------------------------------------------------------------
void setup_wifi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");
}


// ---------------------------------------------------------------------------
// MQTT callback — terima config dari bridge
// ---------------------------------------------------------------------------
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

  // Update interval jika ada field "vib_interval_ms"
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

  // Update thresholds
  if (doc.containsKey("vib_warn")) {
    vibWarning = doc["vib_warn"].as<float>();
    Serial.print("[Config] Vib Warning updated to: ");
    Serial.println(vibWarning);
  }
  
  if (doc.containsKey("vib_crit")) {
    vibCritical = doc["vib_crit"].as<float>();
    Serial.print("[Config] Vib Critical updated to: ");
    Serial.println(vibCritical);
  }
}


// ---------------------------------------------------------------------------
// MQTT reconnect
// ---------------------------------------------------------------------------
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


// ---------------------------------------------------------------------------
// LED & Buzzer status
// ---------------------------------------------------------------------------
void updateStatus(float vibLevel) {
  digitalWrite(LED_GREEN,  LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED,    LOW);

  if (vibLevel >= vibCritical) {
    currentStatus = CRITICAL;
    digitalWrite(LED_RED, HIGH);
  } else if (vibLevel >= vibWarning) {
    currentStatus = WARNING;
    digitalWrite(LED_YELLOW, HIGH);
  } else {
    currentStatus = NORMAL;
    digitalWrite(LED_GREEN, HIGH);
  }
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


// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n--- VIBRATION SENSOR BOOTING ---");

  pinMode(LED_RED,    OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_GREEN,  OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  updateStatus(0.0);  // Default: hijau, buzzer mati

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


// ---------------------------------------------------------------------------
// Loop — NON-BLOCKING (tidak ada delay() di sini)
// ---------------------------------------------------------------------------
void loop() {
  if (!client.connected()) reconnect();
  client.loop();  // proses incoming MQTT (termasuk Config)

  // Update filter terus-menerus (tidak bergantung interval publish)
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

  // Vibration level (untuk LED & Buzzer)
  float accelMag = sqrt(fax*fax + fay*fay + faz*faz);
  float gyroMag  = sqrt(fgx*fgx + fgy*fgy + fgz*fgz);
  float vibLevel = (accelMag + gyroMag) / 2.0;

  updateStatus(vibLevel);
  handleBuzzer();

  // NON-BLOCKING TIMER — publish sesuai interval yang dikonfigurasi
  unsigned long currentMillis = millis();
  if (currentMillis - lastPublishTime >= sensorInterval) {
    lastPublishTime = currentMillis;

    Serial.println("=== VIBRATION DATA ===");
    Serial.print("accel_x: "); Serial.println(fax, 3);
    Serial.print("accel_y: "); Serial.println(fay, 3);
    Serial.print("accel_z: "); Serial.println(faz, 3);
    Serial.print("gyro_x:  "); Serial.println(fgx, 3);
    Serial.print("gyro_y:  "); Serial.println(fgy, 3);
    Serial.print("gyro_z:  "); Serial.println(fgz, 3);
    Serial.printf("vibLevel: %.3f | Interval: %lums\n\n", vibLevel, sensorInterval);

    // Publish Accel
    char accelPayload[150];
    snprintf(accelPayload, sizeof(accelPayload),
      "{\"accel_x\":%.3f,\"accel_y\":%.3f,\"accel_z\":%.3f}",
      fax, fay, faz
    );
    client.publish(topic_accel, accelPayload);

    // Publish Gyro
    char gyroPayload[150];
    snprintf(gyroPayload, sizeof(gyroPayload),
      "{\"gyro_x\":%.3f,\"gyro_y\":%.3f,\"gyro_z\":%.3f}",
      fgx, fgy, fgz
    );
    client.publish(topic_gyro, gyroPayload);
  }
}