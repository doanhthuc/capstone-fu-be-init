FROM openjdk:17-jdk-alpine
# COPY ./build/libs/*.jar app.jar
COPY ./build-for-docker/*.jar app.jar
ENTRYPOINT ["java","-jar","/app.jar"]