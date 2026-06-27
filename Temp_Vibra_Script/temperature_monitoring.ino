#include <Wire.h>
#include <WiFi.h>          
#include <PubSubClient.h>

//I2C PIN CONFIGURATION
#define SHT3X_ADDR  0x44
#define SCL_PIN     22
#define SDA_PIN     21

//LED & BUZZER PINS
#define LED_GREEN   18
#define LED_YELLOW  19
#define LED_RED     23
#define BUZZER_PIN  5

//TEMPERATURE THRESHOLD
#define TEMP_WARNING   20.0  
#define TEMP_CRITICAL  25.0  

const char* ssid = "Wifi 2";
const char* password = "rb234567";
const char* mqtt_server = "broker.emqx.io";
const char* client_id = "ShelterMonitoringTemp";
const char* topic_temp = "tok_esp32_temp_alpha_001/Temp";
const char* topic_hum = "Humidity";    

WiFiClient espClient;
PubSubClient client(espClient);

unsigned long lastSensorReadTime = 0;
unsigned long previousBuzzerMillis = 0;
bool buzzerState = false;

enum StatusLevel { NORMAL, WARNING, CRITICAL };
StatusLevel currentStatus = NORMAL;

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


void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect(client_id)) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void updateStatus(float temperature) {
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED, LOW);


  if (temperature >= TEMP_CRITICAL) {
    currentStatus = CRITICAL; /
    digitalWrite(LED_RED, HIGH);
  } else if (temperature >= TEMP_WARNING) {
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
  }
  else if (currentStatus == CRITICAL) {
    digitalWrite(BUZZER_PIN, HIGH);
  }
  else if (currentStatus == WARNING) {
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
  Wire.begin(SDA_PIN, SCL_PIN);
  Serial.println("SHT3X Temperature Sensor Ready");


  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED, LOW);
  digitalWrite(BUZZER_PIN, LOW);


  setup_wifi();
  client.setServer(mqtt_server, 1883);
}


void readAndPublish() {
  Wire.beginTransmission(SHT3X_ADDR);
  Wire.write(0x24);
  Wire.write(0x00);
  Wire.endTransmission();


  delay(20); 


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


  Serial.printf("Temperature: %.2f C | Humidity: %.2f %%\n", temperature, humidity);
  updateStatus(temperature); 

  String payload = "{\"temperature\": " + String(temperature) + ", \"humidity\": " + String(humidity) + "}";
  client.publish(topic_temp, payload.c_str());
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long currentMillis = millis();
  if (currentMillis - lastSensorReadTime >= 1000) {
    lastSensorReadTime = currentMillis;
    readAndPublish();
  }
 
  handleBuzzer();
}