# Build: from repo root — docker build -f backend/Dockerfile .
FROM eclipse-temurin:17-jdk-jammy AS build
WORKDIR /src
COPY backend/mvnw backend/pom.xml ./
COPY backend/.mvn .mvn
RUN chmod +x mvnw
COPY backend/src ./src
RUN ./mvnw -B -ntp -DskipTests package

FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
RUN useradd -r -s /usr/sbin/nologin appuser
COPY --from=build /src/target/tcm-inquiry-backend-*.jar /app/app.jar
USER appuser
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
