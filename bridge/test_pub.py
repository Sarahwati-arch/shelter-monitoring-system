import paho.mqtt.publish as publish
publish.single('tok_rpi_cam_alpha_001/Accel', '{"accel_x": 0.5, "accel_y": 0.5, "accel_z": 1.0}', hostname='broker.emqx.io')
print("Published test message")
