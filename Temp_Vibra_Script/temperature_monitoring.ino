#include <Wire.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>  // Install via Library Manager: "ArduinoJson" by Benoit Blanchon


// --- I2C PIN CONFIGURATION ---
#define SHT3X_ADDR  0x44
#define SCL_PIN     22
#define SDA_PIN     21


// --- LED & BUZZER PINS ---
#define LED_GREEN   18
#define LED_YELLOW  19
#define LED_RED     23
#define BUZZER_PIN  5


// --- TEMPERATURE THRESHOLDS (local defaults, overridable via MQTT config) ---
float tempWarning = 35.0;   // Yellow
float tempCritical = 40.0;  // Red


const char* ssid     = "Wifi 2";
const char* password = "rb234567";

const char* mqtt_server = "broker.emqx.io";
const char* client_id   = "ShelterMonitoringTemp";
const char* topic_temp  = "tok_esp32_temp_alpha_001/Temp";
// Config topic: bridge will publish {"temp_interval_ms":5000} here
const char* topic_config = "tok_esp32_temp_alpha_001/Config";


WiFiClient espClient;
PubSubClient client(espClient);


// --- SENSOR INTERVAL (ms) — configurable via MQTT ---
unsigned long sensorInterval = 5000;  // default 5 detik

// --- NON-BLOCKING TIMERS ---
unsigned long lastSensorReadTime  = 0;
unsigned long previousBuzzerMillis = 0;
bool buzzerState = false;


// --- STATUS SENSOR SAAT INI ---
enum StatusLevel { NORMAL, WARNING, CRITICAL };
StatusLevel currentStatus = NORMAL;


// ---------------------------------------------------------------------------
// WiFi
// ---------------------------------------------------------------------------
void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected.");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}


// ---------------------------------------------------------------------------
// MQTT callback — terima config dari bridge
// ---------------------------------------------------------------------------
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  // Buat null-terminated string dari payload
  char buf[128];
  unsigned int len = min(length, (unsigned int)(sizeof(buf) - 1));
  memcpy(buf, payload, len);
  buf[len] = '\0';

  Serial.print("[MQTT] Received on ");
  Serial.print(topic);
  Serial.print(": ");
  Serial.println(buf);

  // Parse JSON
  StaticJsonDocument<128> doc;
  DeserializationError err = deserializeJson(doc, buf);
  if (err) {
    Serial.print("[MQTT] JSON parse error: ");
    Serial.println(err.c_str());
    return;
  }

  // Update interval jika ada field "temp_interval_ms"
  if (doc.containsKey("temp_interval_ms")) {
    unsigned long newInterval = doc["temp_interval_ms"].as<unsigned long>();
    // Clamp ke range aman: 1000ms – 60000ms
    if (newInterval >= 1000 && newInterval <= 60000) {
      sensorInterval = newInterval;
      Serial.print("[Config] Sensor interval updated to: ");
      Serial.print(sensorInterval);
      Serial.println(" ms");
    } else {
      Serial.println("[Config] Interval out of range (1000–60000), ignored.");
    }
  }

  // Update thresholds
  if (doc.containsKey("temp_warn")) {
    tempWarning = doc["temp_warn"].as<float>();
    Serial.print("[Config] Temp Warning updated to: ");
    Serial.println(tempWarning);
  }
  
  if (doc.containsKey("temp_crit")) {
    tempCritical = doc["temp_crit"].as<float>();
    Serial.print("[Config] Temp Critical updated to: ");
    Serial.println(tempCritical);
  }
}


// ---------------------------------------------------------------------------
// MQTT reconnect
// ---------------------------------------------------------------------------
void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect(client_id)) {
      Serial.println("connected");
      // (Re-)subscribe ke config topic setiap kali connect / reconnect
      client.subscribe(topic_config);
      Serial.print("Subscribed to: ");
      Serial.println(topic_config);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}


// ---------------------------------------------------------------------------
// LED status
// ---------------------------------------------------------------------------
void updateStatus(float temperature) {
  digitalWrite(LED_GREEN,  LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED,    LOW);

  if (temperature >= tempCritical) {
    currentStatus = CRITICAL;
    digitalWrite(LED_RED, HIGH);
  } else if (temperature >= tempWarning) {
    currentStatus = WARNING;
    digitalWrite(LED_YELLOW, HIGH);
  } else {
    currentStatus = NORMAL;
    digitalWrite(LED_GREEN, HIGH);
  }
}


// ---------------------------------------------------------------------------
// Buzzer pattern (non-blocking)
// ---------------------------------------------------------------------------
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
// Read sensor & publish
// ---------------------------------------------------------------------------
void readAndPublish() {
  Wire.beginTransmission(SHT3X_ADDR);
  Wire.write(0x24);
  Wire.write(0x00);
  Wire.endTransmission();

  delay(20);  // I2C measurement delay (kecil, aman)

  Wire.requestFrom(SHT3X_ADDR, 6);
  if (Wire.available() < 6) {
    Serial.println("Failed to read from sensor!");
    return;
  }

  byte data[6];
  for (int i = 0; i < 6; i++) {
    data[i] = Wire.read();
  }

  uint16_t rawTemp = (data[0] << 8) | data[1];
  uint16_t rawHum  = (data[3] << 8) | data[4];

  float temperature = -45.0 + (175.0 * rawTemp / 65535.0);
  float humidity    = 100.0 * rawHum / 65535.0;

  Serial.printf("[Sensor] Temp: %.2f°C | Hum: %.2f%% | Interval: %lums\n",
                temperature, humidity, sensorInterval);

  updateStatus(temperature);

  // Publish JSON payload
  String payload = "{\"temperature\": " + String(temperature, 2) +
                   ", \"humidity\": "   + String(humidity, 2)    + "}";
  client.publish(topic_temp, payload.c_str());
}


// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  Wire.begin(SDA_PIN, SCL_PIN);
  Serial.println("SHT3X Temperature Sensor Ready");

  pinMode(LED_GREEN,  OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_RED,    OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(LED_GREEN,  LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED,    LOW);
  digitalWrite(BUZZER_PIN, LOW);

  setup_wifi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(mqttCallback);
}


// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();  // proses incoming MQTT messages (termasuk Config)

  // NON-BLOCKING TIMER — interval bisa berubah via MQTT
  unsigned long currentMillis = millis();
  if (currentMillis - lastSensorReadTime >= sensorInterval) {
    lastSensorReadTime = currentMillis;
    readAndPublish();
  }

  // Selalu jalankan buzzer pattern
  handleBuzzer();
}