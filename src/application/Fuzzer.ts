import { camelCase } from 'camel-case'
import { OasMappedOperation } from 'src/oas'
import { PostmanMappedOperation } from '../postman'
import {
  fuzzingConfig,
  FuzzingSchemaItems,
  fuzzRequestBody,
  fuzzRequestQueryParams,
  IntegrationTest,
  OverwriteQueryParamConfig,
  OverwriteRequestBodyConfig,
  PortmanFuzzTypes,
  VariationConfig,
  VariationTestConfig
} from '../types'
import traverse from 'traverse'
import { TestSuite, VariationWriter } from './'
import { OpenAPIV3 } from 'openapi-types'
import { getByPath } from '../utils'
import { QueryParam } from 'postman-collection'
import { PostmanDynamicVarGenerator } from '../services/PostmanDynamicVarGenerator'

export type FuzzerOptions = {
  testSuite: TestSuite
  variationWriter: VariationWriter
}

export class Fuzzer {
  testSuite: TestSuite
  variationWriter: VariationWriter
  public fuzzVariations: any[]

  constructor(options: FuzzerOptions) {
    const { testSuite, variationWriter } = options
    this.testSuite = testSuite
    this.variationWriter = variationWriter
    this.fuzzVariations = []
  }

  public injectFuzzRequestBodyVariations(
    pmOperation: PostmanMappedOperation,
    oaOperation: OasMappedOperation | null,
    variation: VariationConfig,
    variationMeta: VariationTestConfig | IntegrationTest | null
  ): void {
    const fuzzingSet = variation?.fuzzing || []
    // Early exit if no fuzzingSet defined
    if (fuzzingSet.length === 0) return

    // No request body defined
    if (!oaOperation?.schema?.requestBody) return

    // Analyse JSON schema
    const reqBody = oaOperation?.schema?.requestBody as unknown as OpenAPIV3.RequestBodyObject
    const schema = reqBody?.content?.['application/json']?.schema as OpenAPIV3.SchemaObject
    const fuzzItems = this.analyzeFuzzJsonSchema(schema)

    const fuzzReqBodySet = fuzzingSet.filter(fuzz => fuzz?.requestBody) as fuzzingConfig[]

    // Loop over all the fuzzing configurations
    fuzzReqBodySet.map(fuzzItem => {
      const fuzzSet = fuzzItem?.requestBody as fuzzRequestBody[]
      fuzzSet.map(fuzz => {
        if (fuzz?.requiredFields?.enabled === true) {
          this.injectFuzzRequiredVariation(
            pmOperation,
            oaOperation,
            variation,
            variationMeta,
            fuzzItems
          )
        }

        if (fuzz?.minimumNumberFields?.enabled === true) {
          this.injectFuzzMinimumVariation(
            pmOperation,
            oaOperation,
            variation,
            variationMeta,
            fuzzItems
          )
        }

        if (fuzz?.maximumNumberFields?.enabled === true) {
          this.injectFuzzMaximumVariation(
            pmOperation,
            oaOperation,
            variation,
            variationMeta,
            fuzzItems
          )
        }

        if (fuzz?.minLengthFields?.enabled === true) {
          this.injectFuzzMinLengthVariation(
            pmOperation,
            oaOperation,
            variation,
            variationMeta,
            fuzzItems
          )
        }

        if (fuzz?.maxLengthFields?.enabled === true) {
          this.injectFuzzMaxLengthVariation(
            pmOperation,
            oaOperation,
            variation,
            variationMeta,
            fuzzItems
          )
        }
      })
    })
  }

  public injectFuzzRequestQueryParamsVariations(
    pmOperation: PostmanMappedOperation,
    oaOperation: OasMappedOperation | null,
    variation: VariationConfig,
    variationMeta: VariationTestConfig | IntegrationTest | null
  ): void {
    const fuzzingSet = variation?.fuzzing || []
    // Early exit if no fuzzingSet defined
    if (fuzzingSet.length === 0) return

    // No request body defined
    if (!oaOperation?.queryParams) return

    // Analyse JSON schema
    const reqQueryParams = oaOperation?.queryParams as unknown as OpenAPIV3.ParameterObject[]
    reqQueryParams.map(queryParam => {
      const fuzzItems = this.analyzeQuerySchema(queryParam)

      const fuzzQueryParamSet = fuzzingSet.filter(fuzz => fuzz?.requestQueryParams)

      // Loop over all the fuzzing configurations
      fuzzQueryParamSet.map(fuzzItem => {
        const fuzzSet = fuzzItem?.requestQueryParams as fuzzRequestQueryParams[]
        fuzzSet.map(fuzz => {
          if (fuzz?.requiredFields?.enabled === true) {
            this.injectFuzzRequiredVariation(
              pmOperation,
              oaOperation,
              variation,
              variationMeta,
              fuzzItems
            )
          }

          if (fuzz?.minimumNumberFields?.enabled === true) {
            this.injectFuzzMinimumVariation(
              pmOperation,
              oaOperation,
              variation,
              variationMeta,
              fuzzItems
            )
          }

          if (fuzz?.maximumNumberFields?.enabled === true) {
            this.injectFuzzMaximumVariation(
              pmOperation,
              oaOperation,
              variation,
              variationMeta,
              fuzzItems
            )
          }

          if (fuzz?.minLengthFields?.enabled === true) {
            this.injectFuzzMinLengthVariation(
              pmOperation,
              oaOperation,
              variation,
              variationMeta,
              fuzzItems
            )
          }

          if (fuzz?.maxLengthFields?.enabled === true) {
            this.injectFuzzMaxLengthVariation(
              pmOperation,
              oaOperation,
              variation,
              variationMeta,
              fuzzItems
            )
          }
        })
      })
    })
  }

  public injectFuzzRequiredVariation(
    pmOperation: PostmanMappedOperation,
    oaOperation: OasMappedOperation | null,
    variation: VariationConfig,
    variationMeta: VariationTestConfig | IntegrationTest | null,
    fuzzItems: FuzzingSchemaItems | null
  ): void {
    // Early exit if no required fields defined
    const requiredFields = fuzzItems?.requiredFields || []
    if (requiredFields.length === 0) return

    const clonedVariation = JSON.parse(JSON.stringify(variation))

    requiredFields.map(requiredField => {
      // Set Pm request name
      const variationFuzzName = `${pmOperation.item.name}[${variation.name}][required ${requiredField}]`

      const operationVariation = pmOperation.clone({
        newId: camelCase(variationFuzzName),
        name: variationFuzzName
      })

      // Remove requiredField from Postman operation
      const newVariation = JSON.parse(JSON.stringify(clonedVariation))
      if (!newVariation?.overwrites) newVariation.overwrites = []

      if (fuzzItems?.fuzzType === PortmanFuzzTypes.requestBody) {
        const fuzzRequestBody = { key: requiredField, remove: true } as OverwriteRequestBodyConfig
        this.addOverwriteRequestBody(newVariation, fuzzRequestBody)
      }

      if (fuzzItems?.fuzzType === PortmanFuzzTypes.requestQueryParam) {
        const fuzzRequestQueryParam = {
          key: requiredField,
          remove: true
        } as OverwriteQueryParamConfig
        this.addOverwriteRequestQueryParam(newVariation, fuzzRequestQueryParam)
      }

      this.variationWriter.injectVariations(
        operationVariation,
        oaOperation,
        newVariation,
        variationMeta
      )

      // Build up list of Fuzz Variations
      this.fuzzVariations.push(operationVariation)
    })
  }

  public injectFuzzMinimumVariation(
    pmOperation: PostmanMappedOperation,
    oaOperation: OasMappedOperation | null,
    variation: VariationConfig,
    variationMeta: VariationTestConfig | IntegrationTest | null,
    fuzzItems: FuzzingSchemaItems | null
  ): void {
    // Early exit if no fuzzing fields defined
    const minimumNumberFields = fuzzItems?.minimumNumberFields || []
    if (minimumNumberFields.length === 0) return
    if (
      !(PortmanFuzzTypes.requestBody === fuzzItems?.fuzzType) &&
      !(PortmanFuzzTypes.requestQueryParam === fuzzItems?.fuzzType)
    )
      return

    const clonedVariation = JSON.parse(JSON.stringify(variation))

    minimumNumberFields.forEach(field => {
      // Set Pm request name
      const variationFuzzName = `${pmOperation.item.name}[${variation.name}][minimum number value ${field.field}]`

      // Transform to number
      const numberVal =
        typeof field.value === 'number' ? field.value - 1 : parseInt(field.value) - 1

      const operationVariation = pmOperation.clone({
        newId: camelCase(variationFuzzName),
        name: variationFuzzName
      })

      // Change the value of the Postman the request property
      const newVariation = JSON.parse(JSON.stringify(clonedVariation))
      if (!newVariation?.overwrites) newVariation.overwrites = []

      if (fuzzItems?.fuzzType === PortmanFuzzTypes.requestBody) {
        const fuzzRequestBody = {
          key: field.path,
          value: numberVal,
          overwrite: true
        } as OverwriteRequestBodyConfig
        this.addOverwriteRequestBody(newVariation, fuzzRequestBody)
      }

      if (fuzzItems?.fuzzType === PortmanFuzzTypes.requestQueryParam) {
        const fuzzRequestQueryParam = {
          key: field.path,
          value: numberVal.toString(), // Query params should passed as string to Postman
          overwrite: true
        } as unknown as OverwriteQueryParamConfig
        this.addOverwriteRequestQueryParam(newVariation, fuzzRequestQueryParam)
      }

      this.variationWriter.injectVariations(
        operationVariation,
        oaOperation,
        newVariation,
        variationMeta
      )

      // Build up list of Fuzz Variations
      this.fuzzVariations.push(operationVariation)
    })
  }

  public injectFuzzMaximumVariation(
    pmOperation: PostmanMappedOperation,
    oaOperation: OasMappedOperation | null,
    variation: VariationConfig,
    variationMeta: VariationTestConfig | IntegrationTest | null,
    fuzzItems: FuzzingSchemaItems | null
  ): void {
    // Early exit if no fuzzing fields defined
    const maximumNumberFields = fuzzItems?.maximumNumberFields || []
    if (maximumNumberFields.length === 0) return
    if (
      !(PortmanFuzzTypes.requestBody === fuzzItems?.fuzzType) &&
      !(PortmanFuzzTypes.requestQueryParam === fuzzItems?.fuzzType)
    )
      return

    const clonedVariation = JSON.parse(JSON.stringify(variation))

    maximumNumberFields.forEach(field => {
      // Set Pm request name
      const variationFuzzName = `${pmOperation.item.name}[${variation.name}][maximum number value ${field.field}]`

      // Transform to number
      const numberVal =
        typeof field.value === 'number' ? field.value + 1 : parseInt(field.value) + 1

      const operationVariation = pmOperation.clone({
        newId: camelCase(variationFuzzName),
        name: variationFuzzName
      })

      // Change the value of the Postman the request property
      const newVariation = JSON.parse(JSON.stringify(clonedVariation))
      if (!newVariation?.overwrites) newVariation.overwrites = []

      if (fuzzItems?.fuzzType === PortmanFuzzTypes.requestBody) {
        const fuzzRequestBody = {
          key: field.path,
          value: numberVal,
          overwrite: true
        } as OverwriteRequestBodyConfig
        this.addOverwriteRequestBody(newVariation, fuzzRequestBody)
      }

      if (fuzzItems?.fuzzType === PortmanFuzzTypes.requestQueryParam) {
        const fuzzRequestQueryParam = {
          key: field.path,
          value: numberVal.toString(), // Query params should passed as string to Postman
          overwrite: true
        } as unknown as OverwriteQueryParamConfig
        this.addOverwriteRequestQueryParam(newVariation, fuzzRequestQueryParam)
      }

      this.variationWriter.injectVariations(
        operationVariation,
        oaOperation,
        newVariation,
        variationMeta
      )

      // Build up list of Fuzz Variations
      this.fuzzVariations.push(operationVariation)
    })
  }

  public injectFuzzMinLengthVariation(
    pmOperation: PostmanMappedOperation,
    oaOperation: OasMappedOperation | null,
    variation: VariationConfig,
    variationMeta: VariationTestConfig | IntegrationTest | null,
    fuzzItems: FuzzingSchemaItems | null
  ): void {
    // Early exit if no fuzzing fields detected
    const minLengthFields = fuzzItems?.minLengthFields || []
    if (minLengthFields.length === 0) return
    if (
      !(PortmanFuzzTypes.requestBody === fuzzItems?.fuzzType) &&
      !(PortmanFuzzTypes.requestQueryParam === fuzzItems?.fuzzType)
    )
      return

    const clonedVariation = JSON.parse(JSON.stringify(variation))

    minLengthFields.forEach(field => {
      // Set Pm request name
      const variationFuzzName = `${pmOperation.item.name}[${variation.name}][minimum length ${field.field}]`

      let reqObj, reqValue
      if (fuzzItems?.fuzzType === PortmanFuzzTypes.requestBody) {
        // Get request body value
        reqObj = JSON.parse(pmOperation?.item?.request?.body?.raw || '')
        reqValue = getByPath(reqObj, field.path)
        // reqValueLength = reqValue?.toString().length || 0
      }

      if (fuzzItems?.fuzzType === PortmanFuzzTypes.requestQueryParam) {
        // Get request query param value
        const queryParams = JSON.parse(JSON.stringify(pmOperation.item.request.url.query))
        const pmQueryParam = queryParams.find(obj => {
          return obj.key === field.field
        }) as QueryParam
        reqValue = pmQueryParam?.value
        // reqValueLength = reqValue?.toString().length || 0
      }

      // Detect & Replace Postman dynamic variables
      if (typeof reqValue === 'string' && reqValue.includes('{{') && reqValue.includes('}}')) {
        if (reqValue.includes('{{$')) {
          const pmVarGen = new PostmanDynamicVarGenerator()
          reqValue = pmVarGen.replaceDynamicVar(reqValue)
        } else {
          // Plain Postman variable, let skip this
          return
        }
      }

      // Change length of value
      let newLenVal
      if (typeof reqValue === 'number' && typeof field.value === 'number') {
        newLenVal = parseInt(reqValue.toString().substr(0, field.value - 1)) || 0
      }
      if (typeof reqValue === 'string' && typeof field.value === 'number') {
        newLenVal = reqValue.substring(0, field.value - 1)
      }

      const operationVariation = pmOperation.clone({
        newId: camelCase(variationFuzzName),
        name: variationFuzzName
      })

      // Change the length of the Postman the request property
      const newVariation = JSON.parse(JSON.stringify(clonedVariation))
      if (!newVariation?.overwrites) newVariation.overwrites = []

      if (fuzzItems?.fuzzType === PortmanFuzzTypes.requestBody && newLenVal !== undefined) {
        const fuzzRequestBody = {
          key: field.path,
          value: newLenVal,
          overwrite: true
        } as OverwriteRequestBodyConfig
        this.addOverwriteRequestBody(newVariation, fuzzRequestBody)
      }

      if (fuzzItems?.fuzzType === PortmanFuzzTypes.requestQueryParam && newLenVal !== undefined) {
        const fuzzRequestQueryParam = {
          key: field.path,
          value: newLenVal.toString(), // Query params should passed as string to Postman
          overwrite: true
        } as OverwriteQueryParamConfig
        this.addOverwriteRequestQueryParam(newVariation, fuzzRequestQueryParam)
      }

      this.variationWriter.injectVariations(
        operationVariation,
        oaOperation,
        newVariation,
        variationMeta
      )

      // Build up list of Fuzz Variations
      this.fuzzVariations.push(operationVariation)
    })
  }

  public injectFuzzMaxLengthVariation(
    pmOperation: PostmanMappedOperation,
    oaOperation: OasMappedOperation | null,
    variation: VariationConfig,
    variationMeta: VariationTestConfig | IntegrationTest | null,
    fuzzItems: FuzzingSchemaItems | null
  ): void {
    // Early exit if no fuzzing fields detected
    const maxLengthFields = fuzzItems?.maxLengthFields || []
    if (maxLengthFields.length === 0) return
    if (
      !(PortmanFuzzTypes.requestBody === fuzzItems?.fuzzType) &&
      !(PortmanFuzzTypes.requestQueryParam === fuzzItems?.fuzzType)
    )
      return

    const clonedVariation = JSON.parse(JSON.stringify(variation))

    maxLengthFields.forEach(field => {
      // Set Pm request name
      const variationFuzzName = `${pmOperation.item.name}[${variation.name}][maximum length ${field.field}]`

      let reqObj, reqValue
      if (fuzzItems?.fuzzType === PortmanFuzzTypes.requestBody) {
        // Get request body value
        reqObj = JSON.parse(pmOperation?.item?.request?.body?.raw || '')
        reqValue = getByPath(reqObj, field.path)
        // reqValueLength = reqValue?.toString().length || 0
      }

      if (fuzzItems?.fuzzType === PortmanFuzzTypes.requestQueryParam) {
        // Get request query param value
        const queryParams = JSON.parse(JSON.stringify(pmOperation.item.request.url.query))
        const pmQueryParam = queryParams.find(obj => {
          return obj.key === field.field
        }) as QueryParam
        reqValue = pmQueryParam?.value
        // reqValueLength = reqValue?.toString().length || 0
      }

      // Detect & Replace Postman dynamic variables
      if (typeof reqValue === 'string' && reqValue.includes('{{') && reqValue.includes('}}')) {
        if (reqValue.includes('{{$')) {
          const pmVarGen = new PostmanDynamicVarGenerator()
          reqValue = pmVarGen.replaceDynamicVar(reqValue)
        } else {
          // Plain Postman variable, let skip this
          return
        }
      }

      // Change length of value
      if (reqValue && typeof reqValue === 'number' && typeof field.value === 'number') {
        field.value = parseInt(reqValue.toString().padEnd(field.value + 1, '0')) || reqValue
      }
      if (reqValue && typeof reqValue === 'string' && typeof field.value === 'number' && reqValue) {
        field.value = reqValue.padEnd(field.value + 1, reqValue.charAt(0))
      }

      const operationVariation = pmOperation.clone({
        newId: camelCase(variationFuzzName),
        name: variationFuzzName
      })

      // Change the length of the Postman the request property
      const newVariation = JSON.parse(JSON.stringify(clonedVariation))
      if (!newVariation?.overwrites) newVariation.overwrites = []

      if (fuzzItems?.fuzzType === PortmanFuzzTypes.requestBody && reqValue !== undefined) {
        const fuzzRequestBody = {
          key: field.path,
          value: field.value,
          overwrite: true
        } as OverwriteRequestBodyConfig
        this.addOverwriteRequestBody(newVariation, fuzzRequestBody)
      }

      if (fuzzItems?.fuzzType === PortmanFuzzTypes.requestQueryParam && reqValue !== undefined) {
        const fuzzRequestQueryParam = {
          key: field.path,
          value: field.value.toString(), // Query params should passed as string to Postman
          overwrite: true
        } as OverwriteQueryParamConfig
        this.addOverwriteRequestQueryParam(newVariation, fuzzRequestQueryParam)
      }

      this.variationWriter.injectVariations(
        operationVariation,
        oaOperation,
        newVariation,
        variationMeta
      )

      // Build up list of Fuzz Variations
      this.fuzzVariations.push(operationVariation)
    })
  }

  public analyzeFuzzJsonSchema(
    jsonSchema: OpenAPIV3.SchemaObject | undefined
  ): FuzzingSchemaItems | null {
    const fuzzItems = {
      fuzzType: PortmanFuzzTypes.requestBody,
      requiredFields: [],
      minimumNumberFields: [],
      maximumNumberFields: [],
      minLengthFields: [],
      maxLengthFields: []
    } as FuzzingSchemaItems

    if (!jsonSchema) return fuzzItems

    fuzzItems.requiredFields = jsonSchema?.required || []

    traverse(jsonSchema.properties).forEach(function (node) {
      // Register all fuzz-able items
      if (node?.minimum) {
        fuzzItems?.minimumNumberFields?.push({
          path: this.path.join('.'),
          field: this.key,
          value: node.minimum
        })
      }
      if (node?.maximum) {
        fuzzItems?.maximumNumberFields?.push({
          path: this.path.join('.'),
          field: this.key,
          value: node.maximum
        })
      }
      if (node?.minLength) {
        fuzzItems?.minLengthFields?.push({
          path: this.path.join('.'),
          field: this.key,
          value: node.minLength
        })
      }
      if (node?.maxLength) {
        fuzzItems?.maxLengthFields?.push({
          path: this.path.join('.'),
          field: this.key,
          value: node.maxLength
        })
      }
    })

    return fuzzItems
  }

  public analyzeQuerySchema(
    queryParam: OpenAPIV3.ParameterObject | undefined
  ): FuzzingSchemaItems | null {
    const fuzzItems = {
      fuzzType: PortmanFuzzTypes.requestQueryParam,
      requiredFields: [],
      minimumNumberFields: [],
      maximumNumberFields: [],
      minLengthFields: [],
      maxLengthFields: []
    } as FuzzingSchemaItems

    if (!queryParam?.schema || !queryParam.name) return fuzzItems

    const schema = queryParam?.schema as OpenAPIV3.BaseSchemaObject

    // Register all fuzz-able items
    if (queryParam?.required) {
      fuzzItems?.requiredFields?.push(queryParam.name)
    }
    if (schema?.minimum) {
      fuzzItems?.minimumNumberFields?.push({
        path: queryParam.name,
        field: queryParam.name,
        value: schema.minimum
      })
    }
    if (schema?.maximum) {
      fuzzItems?.maximumNumberFields?.push({
        path: queryParam.name,
        field: queryParam.name,
        value: schema.maximum
      })
    }
    if (schema?.minLength) {
      fuzzItems?.minLengthFields?.push({
        path: queryParam.name,
        field: queryParam.name,
        value: schema.minLength
      })
    }
    if (schema?.maxLength) {
      fuzzItems?.maxLengthFields?.push({
        path: queryParam.name,
        field: queryParam.name,
        value: schema.maxLength
      })
    }

    return fuzzItems
  }

  /**
   * Add an OverwriteRequestBodyConfig to a variation
   * @param variation
   * @param fuzzRequestBody
   */
  public addOverwriteRequestBody(
    variation: VariationConfig,
    fuzzRequestBody: OverwriteRequestBodyConfig
  ): VariationConfig {
    const idx = variation.overwrites.findIndex(obj => obj.overwriteRequestBody)
    if (idx === -1) {
      variation.overwrites.push({ overwriteRequestBody: [fuzzRequestBody] })
    } else {
      variation.overwrites[idx].overwriteRequestBody.push(fuzzRequestBody)
    }
    return variation
  }

  /**
   * Add an OverwriteRequestBodyConfig to a variation
   * @param variation
   * @param fuzzRequestQueryParam
   */
  public addOverwriteRequestQueryParam(
    variation: VariationConfig,
    fuzzRequestQueryParam: OverwriteQueryParamConfig
  ): VariationConfig {
    const idx = variation.overwrites.findIndex(obj => obj.overwriteRequestQueryParams)
    if (idx === -1) {
      variation.overwrites.push({ overwriteRequestQueryParams: [fuzzRequestQueryParam] })
    } else {
      variation.overwrites[idx].overwriteRequestQueryParams.push(fuzzRequestQueryParam)
    }
    return variation
  }
}
