import { me as queryMeResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
function getSchema(): GraphQLSchema {
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: GraphQLString,
                    resolve(source, args, context, info) {
                        return typeof source.NOT_THIS === "function" ? source.NOT_THIS(source, args, context, info) : source.NOT_THIS;
                    }
                }
            };
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                me: {
                    name: "me",
                    type: UserType,
                    resolve(source) {
                        return queryMeResolver(source);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [QueryType, UserType]
    });
}
export { getSchema };
