# GeoQuest — Web (Frontend)

App web responsive (PWA) de exploradores para GeoQuest, construida en React.

- Stack y patrones: ver la página de Confluence [Arquitectura Frontend — Scaffolding & Patrones](https://renatageoquest.atlassian.net/wiki/spaces/CDP/pages/3211267/Arquitectura+Frontend+Scaffolding+Patrones)
- Identidad de marca y tokens de diseño: ver [Identidad de Marca & Sistema de Diseño](https://renatageoquest.atlassian.net/wiki/spaces/CDP/pages/3473411/Identidad+de+Marca+Sistema+de+Dise+o)
- Backend / API: [Renata-S-A-S/geoquest](https://github.com/Renata-S-A-S/geoquest)
- Slice de trabajo: `002b-frontend-scaffold` (ver [Secuencia de Slices y Completitud](https://renatageoquest.atlassian.net/wiki/spaces/CDP/pages/1277976/Secuencia+de+Slices+y+Completitud))

Este repositorio aún no tiene el proyecto Vite inicializado — solo la estructura de carpetas base.

Para correr el gate de calidad localmente antes de abrir un PR: `npm run lint && npm run format:check && npm test && npm run build`. En GitHub Actions el mismo gate corre en cada PR pero, al ser un plan gratuito, no bloquea el merge — un check en rojo se debe revisar y corregir igual antes de mergear.
