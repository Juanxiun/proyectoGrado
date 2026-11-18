FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["RestApi.csproj", "./"]
RUN dotnet restore "RestApi.csproj"

COPY . .
RUN dotnet publish "RestApi.csproj" -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 5141 7064

ENV ASPNETCORE_ENVIRONMENT=Development
ENV ASPNETCORE_URLS=http://+:5141

ENTRYPOINT ["dotnet", "RestApi.dll"]