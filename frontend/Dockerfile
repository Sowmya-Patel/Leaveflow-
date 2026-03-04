FROM nginx:alpine

COPY index.html /usr/share/nginx/html/index.html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

ENV AUTH_SERVICE_URL=http://auth-service:5000
ENV LEAVE_SERVICE_URL=http://leave-service:7000

EXPOSE 80
