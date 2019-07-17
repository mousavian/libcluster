const os = require('os')
const fs = require('fs')
const path = require('path')
const async = require('async')
const request = require('request')

function libCluster (options, callback) {
  if (!options.selector) {
    return callback(new Error('"selector" does not exist in options.'))
  }

  const kubernetesMaster = 'kubernetes.default.svc.cluster.local'
  const serviceAccountPath = '/var/run/secrets/kubernetes.io/serviceaccount'
  const allResponses = []
  const getSelector = () => encodeURIComponent(options.selector)
  const getToken = () => getFileContent('token')
  const getNamespace = () => getFileContent('namespace')
  const getFileContent = fileName => {
    const filePath = path.join(serviceAccountPath, fileName)
    try {
      return fs.readFileSync(filePath, 'utf8').trim()
    } catch (err) {
      if (options.debug) console.log(err)
      return ''
    }
  }

  const getEndpoints = done => {
    const token = getToken()
    const namespace = getNamespace()
    const selector = getSelector()
    const endpointsPath = `api/v1/namespaces/${namespace}/endpoints?labelSelector=${selector}`
    const headers = {
      Authorization: `Bearer ${token}`,
    }
    const http_options = {
      headers,
      strictSSL: false,
      rejectUnauthorized: false
    }
    const parseResponse = response => {
      const endpoints = []
      const currentHostname = os.hostname()
      const endpointList = response.items || []
      for (item of endpointList) {
        const subsets = item.subsets || []
        for (subnet of subsets) {
          const port = subnet.ports && subnet.ports.length && subnet.ports[0] ? `:${subnet.ports[0].port}` : ''
          const addresses = subnet.addresses || []
          for (address of addresses) {
            if (address.targetRef && address.targetRef.name !== currentHostname) {
              const ip = address.ip
              endpoints.push(`${ip}${port}`)
            }
          }
        }
      }

      return endpoints
    }

    request.get(`https://${kubernetesMaster}/${endpointsPath}`, http_options, (error, resp) => {
      if (error) return done(error)
      const response = resp.toJSON()
      if (response.statusCode != 200) {
        return done(new Error(`${response.statusCode}: ${response.body}`))
      }

      const endpoints = parseResponse(JSON.parse(response.body.trim()))
      return done(null, endpoints)
    })
  }
  const notify = (endpoint, done) => {
    const requestOpts = Object.assign({ uri: '' }, options, {
      baseUrl: `http://${endpoint}`
    })

    return request(requestOpts, (error, http, body) => {
      if (!error && http.statusCode >= 400) {
        error = new Error(`Error in response with status code: ${http.statusCode}`)
      }
      allResponses.push(body)
      return done(error)
    })
  }

  getEndpoints((error, endpoints) => {
    if (error) return callback(error)
    if (options.debug) console.log('endpoints:', endpoints)
    async.each(endpoints, notify, error => {
      return callback(error, allResponses)
    })
  })
}

module.exports = libCluster
