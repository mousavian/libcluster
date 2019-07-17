# libCluster
A library inspired by [elixir libcluster](https://github.com/bitwalker/libcluster) to send a HTTP message to all other pods in a Kubernetes cluster.


```javascript
libCluster({
  // [required]
  // Kubernetes selector
  selector: 'app=my-application'

  // [optional]
  // all options from "request" lib can be provided
  method: 'POST',
  uri: '/my/endpoint',
  qs: 'myquery=string&key=value',
  form: { some: ['values'] },

  // [optional]
  // for debugging purposes
  debug: true,
}, (error, responses) => {
  console.log(error, responses)
})
```
