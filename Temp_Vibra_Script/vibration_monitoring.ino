#include <Wire.h>
#include <MPU6050_light.h>
#include <WiFi.h>
#include <PubSubClient.h>

// MPU
MPU6050 mpu(Wire);

// FILTER
float fax = 0, fay = 0, faz = 0;
float fgx = 0, fgy = 0, fgz = 0;
float alpha = 0.1;

// BUZZER PIN
#define BUZZER 5

// THRESHOLD
#define THRESH_LOW  10
#define THRESH_HIGH 20

// WIFI & MQTT
const char* ssid = "Wifi 2";
const char* password = "rb234567";
const char* mqtt_server = "broker.emqx.io";
const int mqtt_port = 1883;

WiFiClient espClient;
PubSubClient client(espClient);

// WIFI
void setup_wifi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected");
}

// MQTT
void reconnect() {
  while (!client.connected()) {
    Serial.print("MQTT connecting...");

    if (client.connect("ESP32-VIB-Alpha")) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.println(client.state());
      delay(2000);
    }
  }
}

// BUZZER CONTROL
void setBuzzer(int level) {

  if (level == 0) {
    noTone(BUZZER);         
  }
  else if (level == 1) {
    tone(BUZZER, 1000);      
  }
  else {
    tone(BUZZER, 2000);      
  }
}

// SETUP
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(BUZZER, OUTPUT);
  setBuzzer(0);

  Wire.begin(22, 23, 400000);

  if (mpu.begin() != 0) {
    Serial.println("MPU6050 FAILED");
    while (1);
  }

  Serial.println("MPU6050 READY");

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
}

// LOOP
void loop() {

  if (!client.connected()) reconnect();
  client.loop();

  mpu.update();

  // RAW DATA
  float ax = mpu.getAccX();
  float ay = mpu.getAccY();
  float az = mpu.getAccZ();

  float gx = mpu.getGyroX();
  float gy = mpu.getGyroY();
  float gz = mpu.getGyroZ();

  // LOW PASS FILTER
  fax = alpha * ax + (1 - alpha) * fax;
  fay = alpha * ay + (1 - alpha) * fay;
  faz = alpha * az + (1 - alpha) * faz;

  fgx = alpha * gx + (1 - alpha) * fgx;
  fgy = alpha * gy + (1 - alpha) * fgy;
  fgz = alpha * gz + (1 - alpha) * fgz;

  // VIBRATION LEVEL
  float accelMag = sqrt(fax * fax + fay * fay + faz * faz);
  float gyroMag  = sqrt(fgx * fgx + fgy * fgy + fgz * fgz);

  float vibLevel = (accelMag + gyroMag) / 2.0;

  // BUZZER STATUS
  if (vibLevel < THRESH_LOW) {
    setBuzzer(0);
  }
  else if (vibLevel < THRESH_HIGH) {
    setBuzzer(1);
  }
  else {
    setBuzzer(2);
  }

  // SERIAL DISPLAY
  Serial.println("=== VIBRATION DATA ===");
  Serial.print("accel_x: ");
  Serial.println(fax, 3);

  Serial.print("accel_y: ");
  Serial.println(fay, 3);

  Serial.print("accel_z: ");
  Serial.println(faz, 3);

  Serial.print("gyro_x: ");
  Serial.println(fgx, 3);

  Serial.print("gyro_y: ");
  Serial.println(fgy, 3);

  Serial.print("gyro_z: ");
  Serial.println(fgz, 3);

  Serial.printf("vibLevel: %.3f\n", vibLevel);
  Serial.println();

  // MQTT - ACCEL
  char accelPayload[150];

  snprintf(
    accelPayload,
    sizeof(accelPayload),
    "{\"accel_x\":%.3f,\"accel_y\":%.3f,\"accel_z\":%.3f}",
    fax, fay, faz
  );

  client.publish(
    "tok_esp32_vib_alpha_001/Accel",
    accelPayload
  );

  // MQTT - GYRO
  char gyroPayload[150];

  snprintf(
    gyroPayload,
    sizeof(gyroPayload),
    "{\"gyro_x\":%.3f,\"gyro_y\":%.3f,\"gyro_z\":%.3f}",
    fgx, fgy, fgz
  );

  client.publish(
    "tok_esp32_vib_alpha_001/Gyro",
    gyroPayload
  );

  delay(1000);
}